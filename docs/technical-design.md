# Technical Design

## Overview

Devin Switcher is a local Node/TypeScript application with:

- Thin `dsw` CLI.
- Local HTTP service bound to `127.0.0.1`.
- React SPA served by the same service.
- SQLite persistence.
- One isolated XDG profile directory per Devin account.

V1 is not a proxy. It launches the official `devin` binary with profile-scoped environment variables.

## Runtime Model

```text
dsw CLI
  -> command handler
  -> core service
  -> SQLite
  -> profile filesystem
  -> child_process.spawn("devin", args, profile env)
```

For `dsw ui`:

```text
dsw ui
  -> start local HTTP server on 127.0.0.1:0
  -> mint one-shot browser token
  -> open browser
  -> serve React SPA and /api/*
```

## Profile Isolation

Each account has a profile root:

```text
~/.local/share/devin-switcher/profiles/<account-id>/
  data/
    devin/
      credentials.toml
      cli/
      mcp/
  config/
    devin/
      config.json
```

Runner environment:

```ts
{
  ...process.env,
  XDG_DATA_HOME: "<profile>/data",
  XDG_CONFIG_HOME: "<profile>/config"
}
```

`HOME` is left unchanged. Devin resolves credentials through `XDG_DATA_HOME/devin/credentials.toml`.

## Component Boundaries

### CLI

Responsibilities:

- Parse args.
- Dispatch command.
- Print human-readable status.
- Pass through child exit codes.

CLI should not contain scheduling or quota rules. It calls core services.

### Server

Responsibilities:

- Serve SPA.
- Expose local API.
- Enforce loopback and token auth.
- Stream live redacted session tail.

No CORS. Bind `127.0.0.1` only.

### Core Profiles

Responsibilities:

- Resolve profile paths.
- Create profile dirs with permissions.
- Import global credential by read-only copy.
- Build Devin env.
- Run `devin auth login` and `devin auth status`.

Credential files are opaque. Do not parse except for optional JWT loading in quota endpoint client after Phase 1 approves it.

### Core Runner

Responsibilities:

- Acquire per-profile lock.
- Create session row.
- Spawn Devin subprocess.
- Maintain heartbeat.
- Stream redacted live output.
- Detect known status signals.
- Release lock and persist summary.

Runner never switches credentials mid-session.

### Core Scheduler

Responsibilities:

- Apply eligibility predicate.
- Rank eligible accounts.
- Persist selection cursor.

Strategies:

- `manual`
- `quota-weighted`
- `round-robin`

Default: `quota-weighted`.

### Core Quota

Responsibilities:

- Normalize quota snapshots when endpoint mode is enabled.
- Mark accounts limited/ready/needs_login from trusted signals.
- Preserve fallback behavior when endpoint polling is disabled.

Quota mode:

```text
fallback-first
optional server endpoint after Phase 1 spike approval
```

### Events

Append-only log for decisions:

- session_start
- session_end
- quota_poll
- signal_detected
- auto_mark_limited
- manual_override
- stale_lock_cleaned

Payloads are redacted before persistence.

## Selection Algorithm

Eligibility:

```text
enabled
AND status in ready|unknown
AND no live lock
AND not explicitly limited
AND quota above reserve when quota snapshot exists
AND login not known invalid
```

Quota-weighted:

```text
score = min(daily_remaining_pct ?? 100, weekly_remaining_pct ?? 100)
pick highest score
tie: order_index ASC
```

Round-robin:

```text
eligible sorted by order_index
find last_selected_account_id
pick next index modulo length
```

Manual:

```text
user-selected account must pass same eligibility checks unless --force is added in a future version
```

## Session Lifecycle

```text
start
  -> insert sessions row
  -> acquire profile_locks row
  -> spawn Devin
  -> start heartbeat
  -> stream redacted output
  -> detect structured/output signals
exit
  -> stop heartbeat
  -> update session row
  -> release lock
  -> enqueue quota refresh if enabled
  -> emit events
```

Stale lock cleanup:

- TTL: 120 seconds.
- Before deleting, verify PID is not alive.
- `dsw doctor` can clean manually.

## Structured Signal Observability

Phase 1 must verify which modes expose machine-readable `finish_reason`.

Matrix defaults until proven:

| Mode | Expected Signal | Implementation Mode |
|---|---|---|
| `devin -p` | Unknown | output fallback until tested |
| interactive `devin` | Unknown | output fallback until tested |
| `devin acp` | Likely structured JSON-RPC | structured parser after fixture |

Business logic must not assume `finish_reason` exists for every run mode.

## Quota Endpoint Mode

Default implementation posture:

```text
fallback-first with optional endpoint
```

Fallback signals:

- `finish_reason == quota_exhausted` when observable.
- Literal `Quota exhausted`.
- Literal `Upgrade your plan or wait for your quota to reset`.
- Manual `mark-limited`.

Endpoint polling is enabled only after:

1. Endpoint path and payload are captured.
2. Response schema is documented.
3. Security/fragility risk is accepted.
4. Fallback-only mode still works if endpoint breaks.

## HTTP API

All endpoints require:

- Loopback remote address.
- `X-Dsw-Token`.

Endpoints:

```text
GET  /api/accounts
POST /api/accounts
POST /api/accounts/:id/login
POST /api/accounts/:id/disable
POST /api/accounts/:id/enable
POST /api/accounts/:id/mark-limited
POST /api/accounts/:id/unmark
POST /api/accounts/:id/refresh-quota
DELETE /api/accounts/:id

POST /api/run
GET  /api/sessions
GET  /api/sessions/:id
GET  /api/sessions/:id/stream
POST /api/sessions/:id/stop

GET  /api/events
GET  /api/settings
PUT  /api/settings
POST /api/auth/exchange
GET  /api/health
```

UI token handoff:

1. `dsw ui` mints one-shot token, expires in 60s.
2. Browser opens with `?t=<token>`.
3. SPA posts token to `/api/auth/exchange`.
4. Server returns persistent local UI token.
5. SPA calls `history.replaceState()` to remove token from URL.
6. SPA stores token in `sessionStorage`.

## Redaction

Redact before logs, DB events, UI responses:

- `windsurf_api_key`
- `Authorization` header values
- JWT-like strings matching `eyJ...`
- `devin-session-token$...`
- Credential file bodies

Final API response middleware should apply a last-pass redactor to strings.

## Filesystem Permissions

```text
~/.local/share/devin-switcher/              0700
~/.local/share/devin-switcher/app.db        0600
~/.local/share/devin-switcher/ui-token      0600
profiles/<id>/                              0700
profiles/<id>/data/devin/credentials.toml   0600
```

## Failure Handling

| Failure | State | Behavior |
|---|---|---|
| Missing credential | needs_login | skip selectors, show login CTA |
| 401 from quota endpoint | needs_login | never mark limited |
| Quota exhausted signal | limited | skip until reset/manual unmark |
| Rate limited string | ready + cooldown event | do not mark limited |
| Turn limit reached | ready + info event | do not mark limited |
| Poll failure | error after threshold | keep last snapshot |
| Child crash | session exit_code set | release/stale lock cleanup |

## Phase 2 Build Choices

Locked:

- TypeScript.
- Node service.
- SQLite.
- React SPA.

Still selected in Phase 2 kickoff:

- SQLite library: `better-sqlite3` vs `node:sqlite`.
- HTTP framework: `hono` vs `fastify`.
- CLI parser: `cac` vs `commander`.

Recommended:

- `better-sqlite3` for Node 20 compatibility.
- `hono` for small local API.
- `commander` for stable CLI.
