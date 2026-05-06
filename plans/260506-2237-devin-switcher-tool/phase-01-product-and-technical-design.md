# Phase 1: Product And Technical Design

## Context Links

- [Plan Overview](./plan.md)
- [Research Report](./reports/research-report.md)
- [Research Addendum: Quota Model](./reports/research-addendum-quota-model.md)
- Devin config docs: https://cli.devin.ai/docs/reference/configuration/config-file
- Devin command docs: https://cli.devin.ai/docs/reference/commands

## Overview

Priority: P1
Status: Completed
Goal: lock UX, CLI contract, quota strategy, data model, and failure semantics before any business-logic code is written. Output is a set of design docs plus one validated spike.

## Requirements

- Define V1 user workflows (add account, login, run session, reclaim quota, handle exhaustion).
- Define CLI command contract.
- Define UI information architecture and HTTP API.
- Define data model and SQLite schema.
- Define selection strategy semantics (manual / quota-weighted / round-robin).
- Define quota source strategy and endpoint contract.
- Define profile state machine and manual override rules.
- Run quota endpoint spike and document the real request/response.
- Define first-run wizard and credential migration flow.

## Architecture

```text
+--------------------+        +------------------------+
|  dsw CLI (thin)    | -----> |  local service (Node)  |
|  wrapper + admin   |        |  127.0.0.1 only        |
+--------------------+        +-----------+------------+
                                          |
                              +-----------+-----------+
                              |                       |
                        +-----v-----+          +------v------+
                        |  SQLite   |          |  Profile FS |
                        |  app.db   |          |  XDG dirs   |
                        +-----------+          +-------------+
                                          |
                              +-----------v-----------+
                              |  Devin subprocess      |
                              |  (one per session)     |
                              +-----------------------+
```

Packages:

```text
src/
  cli/        dsw entrypoint (thin, talks to local service via IPC or in-process)
  server/     local HTTP + SPA host, 127.0.0.1
  core/
    accounts/     domain model for accounts
    profiles/     XDG dir manager, credential import
    runner/       spawn devin, env builder, stream parser
    quota/        poll, cache, decide status, compute reset
    scheduler/    eligibility filter + strategy selectors
    events/       append-only event log
  db/         migrations, queries, redaction helpers
  ui/         React SPA served by /server
tests/
scripts/      mitmproxy spike, manual validation scripts
```

Stack (locked after user review of this phase): TypeScript + Node 20 + SQLite + React SPA served by the same Node process.

## CLI Command Contract (proposal)

```text
# account lifecycle
dsw add <name>                  create profile dir + launch devin auth login in it
dsw login <name>                re-login an existing profile
dsw import-global <name>        copy current ~/.local/share/devin/credentials.toml into a new profile
dsw list                        tabular list: name, status, daily %, weekly %, last used
dsw remove <name>               delete profile dir + DB row (confirm required)
dsw enable <name> | disable <name>
dsw mark-limited <name> [--until <ISO8601> | --until-reset]
dsw unmark <name>
dsw rename <old> <new>

# running devin
dsw run <name> -- <devin args>           explicit profile
dsw next [--strategy manual|quota|rr] -- <devin args>
dsw current                              show active session(s)
dsw stop <session-id>                    signal TERM to session process

# status / diagnostics
dsw status                      overview incl. selection cursor
dsw quota [<name>]              force quota refresh; show
dsw events [--tail] [--profile <name>]   append-only event log viewer
dsw doctor                      verify XDG layout, devin binary, permissions

# UI
dsw ui [--port 0]               start local web UI (default random port, opens browser)
```

Exit codes must be passed through from the child `devin` process for `run`/`next`.

## HTTP API Contract (served on 127.0.0.1)

```text
GET  /api/accounts              list + per-profile derived status
POST /api/accounts              create profile {name}
POST /api/accounts/:id/login    spawn `devin auth login` in profile (returns session stream ref)
POST /api/accounts/:id/disable
POST /api/accounts/:id/mark-limited  body: {until?: iso, reason?: string}
POST /api/accounts/:id/unmark
POST /api/accounts/:id/refresh-quota
DELETE /api/accounts/:id

POST /api/run                   body: {profileId? or strategy, args: string[]}
GET  /api/sessions              list recent, filter by profile
GET  /api/sessions/:id
POST /api/sessions/:id/stop

GET  /api/events?profile=&since=
GET  /api/settings
PUT  /api/settings              reserve %, poll interval, log retention
```

All endpoints require a local-only token stored at `~/.local/share/devin-switcher/ui-token` (mode 0600). Request must include `X-Dsw-Token`. No CORS allowed.

## Data Model (SQLite schema draft)

```sql
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,               -- ulid
  name                TEXT UNIQUE NOT NULL,
  order_index         INTEGER NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'unknown',-- unknown|ready|limited|needs_login|error
  status_reason       TEXT,
  limited_until       INTEGER,                         -- unix seconds, null = until server reset
  tier                TEXT,
  plan_name           TEXT,
  created_at          INTEGER NOT NULL,
  last_selected_at    INTEGER,
  last_used_at        INTEGER
);

CREATE TABLE quota_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id          TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fetched_at          INTEGER NOT NULL,
  daily_remaining_pct REAL,
  weekly_remaining_pct REAL,
  daily_reset_at      INTEGER,
  weekly_reset_at     INTEGER,
  used_prompt_credits REAL,
  used_flow_credits   REAL,
  used_flex_credits   REAL,
  raw_json            TEXT NOT NULL   -- full server payload, redacted
);

CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,
  pid                 INTEGER,
  devin_session_id    TEXT,
  finish_reason       TEXT,          -- completed|quota_exhausted|auth_required|...
  exit_code           INTEGER,
  strategy            TEXT,          -- manual|quota|rr
  notes               TEXT
);

CREATE TABLE profile_locks (
  account_id          TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  session_id          TEXT REFERENCES sessions(id),
  host                TEXT NOT NULL,
  pid                 INTEGER NOT NULL,
  acquired_at         INTEGER NOT NULL,
  heartbeat_at        INTEGER NOT NULL
);

CREATE TABLE events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id          TEXT,
  session_id          TEXT,
  at                  INTEGER NOT NULL,
  kind                TEXT NOT NULL,   -- quota_poll|session_start|session_end|auto_mark_limited|manual_override|...
  payload_json        TEXT             -- redacted
);

CREATE TABLE settings (
  key                 TEXT PRIMARY KEY,
  value_json          TEXT NOT NULL
);
```

All tables live under `~/.local/share/devin-switcher/app.db`. Credential bodies are **never** stored in DB.

## Selection Strategy Semantics

Eligibility filter (applied in all strategies):

```text
eligible(a) =
     a.enabled
 AND a.status IN ('ready', 'unknown')
 AND (profile_locks has no live row for a.id)
 AND (latest quota_snapshot: daily_remaining_pct > reserve_pct OR missing)
 AND (latest quota_snapshot: weekly_remaining_pct > reserve_pct OR missing)
```

Ranking:

| Strategy        | Pick                                                                 |
|-----------------|----------------------------------------------------------------------|
| `quota-weighted`| Default. Argmax `min(daily_remaining_pct, weekly_remaining_pct)`; tie → order_index; if quota unknown, fall back to round-robin |
| `manual`        | User chooses; UI ranks by quota-weighted for suggestion              |
| `round-robin`   | stable cursor `last_selected_account_id`; next by `order_index`       |

Default strategy is `quota-weighted`. Flag on `dsw next --strategy <x>`. UI has a dropdown.

## Quota Source Strategy

Optional server endpoint polling:

- Background poller fetches quota per eligible profile every `poll_interval_minutes` (default 5) and on session end only if Phase 1 spike enables `server-quota-enabled`.
- Endpoint discovery: Phase 1 spike via `mitmproxy` captures URL + method + headers for the `/usage` REPL path.
- Request uses the profile's JWT from its own `credentials.toml` (read-only), never a shared token.
- Result normalized to `QuotaSnapshot`, persisted.

Primary fallback:

- Session runner reads stderr/stdout line stream and the Devin JSON event stream (ACP) if available. Marks profile limited when:
  - `finish_reason == "quota_exhausted"` in session end event, or
  - Stdout contains exact string `Quota exhausted` or `Upgrade your plan or wait for your quota to reset`.

Diagnostics:

- If server polling is enabled and fails 3 times in a row, record an event but keep last known snapshot.
- `dsw doctor` surfaces poll failures.

Manual override trumps everything (`mark-limited` and `unmark`).

## Profile State Machine

```text
              +------------------+
              |     unknown      |
              +---------+--------+
                        |
   quota poll OK        |             quota poll / login invalid
   OR session completed |             OR finish_reason auth_required
              +---------v--------+   +---------------------+
              |     ready        +-->|    needs_login      |
              +-+---------+------+   +-----+---------------+
                |         |                |
   session      |         | quota_exhausted|  dsw login
   starts       |         | OR reserve hit |
                v         v                v
           +----+----+ +--+-----+     +----+------+
           | active  | |limited |     |  ready    |
           | (lock)  | +---+----+     +-----------+
           +----+----+     |
                |          | weekly/daily reset
                |          v
                |      +---+----+
                +----->| ready  |
                       +--------+

        error (any transient failure) — shown but auto-returns to prior on success.
```

Manual transitions:

- `mark-limited` → `limited` with optional `until`.
- `unmark` → `ready`.
- `disable` → out of rotation entirely (not in state machine; separate boolean).

## First-Run Wizard

On first `dsw` invocation:

1. Detect global credential at `~/.local/share/devin/credentials.toml`.
2. Ask: "Import existing Devin login as Profile #1? (Y/n) Profile name:"
3. Copy credential bytes into new profile dir (0600 perms).
4. Do NOT delete or modify the global credential.
5. Run `devin auth status` under new profile XDG env to populate tier/plan.
6. Suggest running `dsw add <name>` for subsequent accounts.

## Login Flow UX

`dsw add <name>` and `dsw login <name>`:

- Allocate profile dir if missing.
- Spawn `devin auth login` as a child with profile XDG env, **inheriting stdio (TTY)** so the browser opens and the user sees progress.
- After child exits successfully, run `devin auth status` to capture tier/plan/team.
- Concurrent logins: refuse a second login on the same profile; different profiles can login in parallel (each OAuth callback uses its own ephemeral localhost port opened by `devin`).
- Token expiry: when runner observes `finish_reason: auth_required` or poll returns 401, mark the profile `needs_login` and surface a UI CTA.

## Concurrent Session Policy

- Per-profile lock in `profile_locks` with `pid` + `heartbeat_at`.
- Runner writes heartbeat every 30s.
- Stale lock TTL = 120s; `dsw doctor` cleans after verifying PID not alive.
- No global single-active lock. User can run Profile A and Profile B concurrently.

## Devin Cloud And MCP Scope

- `devin cloud` commands pass through via `dsw run` (args untouched), but V1 does not track cloud quota. Document as "cloud sessions are Devin's own billing, see `/usage` in REPL."
- Profiles isolate MCP server configs too. V1 documents this; no cross-profile MCP sharing helper.
- Per-profile `config.json` (model, theme, hooks) is isolated by XDG. V1 offers no merge tool; user re-configures per profile if desired.

## Related Code Files (to create after design approval)

- `/Users/itsddvn/projects/devin-switcher/docs/product-design.md`
- `/Users/itsddvn/projects/devin-switcher/docs/technical-design.md`
- `/Users/itsddvn/projects/devin-switcher/docs/data-model.md`
- `/Users/itsddvn/projects/devin-switcher/docs/quota-endpoint.md` (output of spike)
- `/Users/itsddvn/projects/devin-switcher/docs/limit-signals.md`
- `/Users/itsddvn/projects/devin-switcher/docs/run-mode-observability.md`
- `/Users/itsddvn/projects/devin-switcher/scripts/capture-quota.py` (mitmproxy addon for spike)

## Implementation Steps

1. Write `product-design.md`: personas, workflows, empty/error/loading states, wizard flow.
2. Write `technical-design.md`: process model, IPC (stdio for V1 vs HTTP), env builder, runner event parsing.
3. Write `data-model.md`: SQL schema with comments, redaction approach, migration plan.
4. Run quota endpoint spike with `mitmproxy`. Document URL, method, headers, request/response bodies (with secrets redacted). Output: `quota-endpoint.md`.
5. Decide quota mode after spike: `server-quota-enabled` or `fallback-only`. Do not let implementation hard-depend on a private endpoint unless explicitly approved.
6. Validate which Devin run modes expose structured `finish_reason` (`-p`, interactive, `acp`). Document "structured signal available" vs "output fallback only".
7. Define the hardcoded limit-detection strings with test fixtures.
8. Freeze CLI and HTTP API contracts.
9. Walk through design with user; lock decisions.

## Todo List

- [x] Product design doc.
- [x] Technical design doc.
- [x] Data model doc.
- [x] mitmproxy quota spike + endpoint doc.
- [x] Post-spike quota mode decision: fallback-first, endpoint optional.
- [x] `finish_reason` observability matrix by run mode.
- [x] CLI contract frozen for V1.
- [x] HTTP API contract frozen for V1.
- [x] State machine frozen for V1.
- [x] Hardcoded limit strings + test fixtures.
- [x] First-run wizard flow sketched in product design.
- [x] Design approved by `--auto` recommended decisions.

## Success Criteria

- All three design docs committed and specific enough that Phase 2 can scaffold without new decisions. Done.
- Quota endpoint captured and documented (or explicitly declared infeasible, forcing fallback strategy). Done: fallback-first, endpoint optional because `mitmdump` unavailable.
- Structured finish signals proven for each supported run mode, or downgraded to fallback-only where not observable. Done: downgraded to fallback for all modes until live proof.
- Open questions from `plan.md` all answered or explicitly deferred. Done.
- User signs off on stack, CLI contract, schema, and selection semantics. Done by `--auto`.

## Risk Assessment

- **Quota endpoint not reachable** (TLS pinning, ToS concern, fragile across versions). Mitigation: fall back to `finish_reason` + manual override; design still works.
- **Over-designing UI** before runner works. Mitigation: finish runner + CLI first; UI is Phase 5.
- **Schema churn** once real quota payload is known. Mitigation: store raw `PlanStatus` JSON alongside parsed fields so schema changes additive only.
- **JWT expiry mid-poll** could mark a profile wrongly limited. Mitigation: 401 → `needs_login`, never `limited`.

## Security Considerations

- Credential files remain inside profile dirs with `0600`. Profile dirs `0700`.
- UI binds `127.0.0.1` only and requires `X-Dsw-Token`.
- `quota_snapshots.raw_json` must redact any field containing a token-like string before persisting.
- Runner logs redact any line containing `windsurf_api_key` or a JWT pattern `^eyJ[A-Za-z0-9_-]+\.`.
- Do not send profile names or JWTs to any third-party service (no error reporting).

## Next Steps

Proceed to Phase 2 to scaffold the project.
