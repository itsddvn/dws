# Product Design

## Overview

Devin Switcher is a local-first account manager for users with multiple legitimate Devin CLI accounts. It gives one place to manage profiles, see quota health, and launch Devin with the best available account without rewriting global credentials.

V1 is operational software, not a polished desktop product. The UI exists to reduce interruption and make account state visible.

## Users

Primary user:

- Single developer on macOS.
- Uses Devin CLI heavily.
- Has multiple authorized Devin accounts.
- Wants quick switching and quota awareness.

Non-users for V1:

- Teams sharing accounts.
- Multi-host deployments.
- Cloud billing admins.
- Users needing a native desktop package.

## Core Principles

- Never mutate global Devin credentials in normal flows.
- Prefer explicit visibility over hidden automation.
- Make the safe path fast.
- Store only what the tool needs.
- Degrade gracefully when Devin internals change.

## V1 Workflows

### First Run

1. User runs `dsw`.
2. App creates local data dir and SQLite DB.
3. App detects `~/.local/share/devin/credentials.toml`.
4. App asks to import it as Profile #1.
5. If accepted, app copies the credential into the new profile XDG dir.
6. App runs `devin auth status` under that profile env.
7. App shows account status and next recommended action.

Global credential is copied read-only. It is not deleted or modified.

### Add Account

```bash
dsw add work-alt
```

Flow:

1. Create profile dir.
2. Spawn `devin auth login` with profile XDG env and inherited TTY.
3. User completes Devin browser login.
4. App runs `devin auth status`.
5. Account appears as `ready` or `needs_login`.

### Run Explicit Profile

```bash
dsw run primary -- -p "fix the tests"
```

Flow:

1. Resolve profile by name.
2. Check enabled, login, lock, quota/limited status.
3. Acquire per-profile lock.
4. Spawn Devin with profile XDG env.
5. Stream output.
6. On exit, release lock, persist summary, refresh quota if enabled.
7. Return Devin child exit code.

### Run Suggested Account

```bash
dsw next -- -p "review this diff"
```

Default selector: `quota-weighted`.

Flow:

1. Filter eligible profiles.
2. Pick account with best quota health.
3. If quota unknown for all accounts, fall back to stable round-robin order.
4. Run Devin as above.

### Handle Exhaustion

Detected signals:

- Structured `finish_reason == "quota_exhausted"` when observable.
- Known CLI output strings.
- Server quota snapshot when endpoint polling is enabled.
- Manual `mark-limited`.

UI result:

- Account status becomes `limited`.
- Account is skipped by all selectors.
- Reset timestamp shown if known.
- User can manually unmark.

### Reclaim After Reset

Flow:

1. Background tick sees `limited_until` or server reset timestamp passed.
2. Account transitions to `unknown`.
3. App refreshes quota if endpoint enabled.
4. Account becomes eligible if quota is above reserve.

## UI Information Architecture

### Accounts

Purpose: manage account pool.

Content:

- Name
- Status
- Tier / plan
- Daily remaining %
- Weekly remaining %
- Active lock/session
- Last used
- Last error

Actions:

- Add
- Login
- Import global
- Enable / disable
- Mark limited
- Unmark
- Refresh quota
- Remove

### Current Run

Purpose: see active sessions.

Content:

- Account
- PID
- Started at
- Duration
- Command summary
- Live redacted tail, in memory only

Actions:

- Stop session
- Open session details

### Sessions

Purpose: audit recent runs without storing sensitive raw output.

Content:

- Account
- Started / ended
- Exit code
- Finish reason
- Strategy
- Notes / last signal

### Settings

Purpose: tune local behavior.

Fields:

- Default strategy: `quota-weighted`
- Reserve percentage
- Poll interval
- Log retention policy
- Raw log persistence: off by default
- Devin binary path

### Diagnostics

Purpose: explain why something is unavailable.

Content:

- Devin binary detected
- Profile dir permissions
- DB path
- UI bind address
- Quota endpoint mode
- Recent events
- Stale locks

## Empty States

No accounts:

```text
No Devin profiles yet.
Import your current Devin login or add a new account.
```

No quota:

```text
Quota not fetched yet.
This account can still be used. Quota will refresh after a run.
```

No eligible accounts:

```text
No eligible profile.
Check disabled, login, quota, and active session states.
```

## Error States

`needs_login`:

- Show login CTA.
- Explain that token is missing or expired.

`limited`:

- Show reset time if known.
- Show source: server quota, finish reason, output pattern, manual.

`error`:

- Show last redacted error.
- Keep manual actions available.

## CLI Contract

Account lifecycle:

```bash
dsw add <name>
dsw login <name>
dsw import-global <name>
dsw list
dsw remove <name>
dsw enable <name>
dsw disable <name>
dsw mark-limited <name> [--until <ISO8601> | --until-reset]
dsw unmark <name>
dsw rename <old> <new>
```

Run commands:

```bash
dsw run <name> -- <devin args>
dsw next [--strategy manual|quota|rr] -- <devin args>
dsw current
dsw stop <session-id>
```

Diagnostics:

```bash
dsw status
dsw quota [<name>]
dsw events [--tail] [--profile <name>]
dsw doctor
dsw ui [--port 0]
```

`run` and `next` pass through child exit code.

## Selection Defaults

Default strategy: `quota-weighted`.

Reason: user wants least interruption. Quota-weighted makes better use of available accounts than strict round-robin once quota data exists.

Fallback when quota is unknown: stable round-robin by `order_index`.

Manual remains available:

```bash
dsw next --strategy manual -- ...
```

## Log Policy

V1 default:

- No raw output persisted.
- UI live tail only, redacted server-side, kept in memory.
- DB stores session summary, exit code, finish reason, status signals.

Raw persistence is out of scope unless explicitly enabled in a future phase.

## V1 Acceptance

- User can import current account.
- User can add second account.
- User can run explicit and suggested profile.
- Limited accounts are skipped.
- Global Devin credential hash remains unchanged.
- UI shows enough state to explain every selector decision.
