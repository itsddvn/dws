# Data Model

## Overview

SQLite is the source of truth for account metadata, quota snapshots, sessions, locks, settings, and append-only events.

Credential bodies are not stored in SQLite. They live only inside profile XDG dirs.

Database path:

```text
~/.local/share/devin-switcher/app.db
```

## Tables

### accounts

Stores one row per Devin profile.

```sql
CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT UNIQUE NOT NULL,
  order_index         INTEGER NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'unknown',
  status_reason       TEXT,
  limited_until       INTEGER,
  tier                TEXT,
  plan_name           TEXT,
  email               TEXT,
  team_id             TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  last_selected_at    INTEGER,
  last_used_at        INTEGER
);
```

Allowed `status` values:

```text
unknown
ready
active
limited
needs_login
error
```

Notes:

- `enabled = 0` removes account from all selectors.
- `limited_until = NULL` means until server reset or manual unmark.
- `active` is derived from locks in UI; storing it is optional. Prefer derived status where practical.

### quota_snapshots

Stores normalized quota payloads.

```sql
CREATE TABLE quota_snapshots (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id            TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fetched_at            INTEGER NOT NULL,
  source                TEXT NOT NULL,
  daily_remaining_pct   REAL,
  weekly_remaining_pct  REAL,
  daily_reset_at        INTEGER,
  weekly_reset_at       INTEGER,
  used_prompt_credits   REAL,
  available_prompt_credits REAL,
  used_flow_credits     REAL,
  available_flow_credits REAL,
  used_flex_credits     REAL,
  available_flex_credits REAL,
  raw_json              TEXT
);
```

`source` values:

```text
server_endpoint
auth_status
manual
fallback
```

`raw_json` is redacted before persistence. If endpoint mode is disabled, `raw_json` may be NULL.

### sessions

Stores process/session summary.

```sql
CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,
  pid                 INTEGER,
  devin_session_id    TEXT,
  finish_reason       TEXT,
  exit_code           INTEGER,
  strategy            TEXT NOT NULL,
  command_summary     TEXT,
  notes               TEXT
);
```

Raw output is not persisted in V1.

### profile_locks

Prevents accidental double-start on the same profile.

```sql
CREATE TABLE profile_locks (
  account_id          TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  session_id          TEXT REFERENCES sessions(id),
  host                TEXT NOT NULL,
  pid                 INTEGER NOT NULL,
  acquired_at         INTEGER NOT NULL,
  heartbeat_at        INTEGER NOT NULL
);
```

Stale lock rule:

```text
now - heartbeat_at > 120s AND pid not alive => delete lock
```

### events

Append-only decision log.

```sql
CREATE TABLE events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id          TEXT,
  session_id          TEXT,
  at                  INTEGER NOT NULL,
  kind                TEXT NOT NULL,
  payload_json        TEXT
);
```

Event kinds:

```text
account_created
account_updated
credential_imported
login_started
login_completed
session_start
session_end
quota_poll
quota_poll_failed
signal_detected
auto_mark_limited
manual_override
stale_lock_cleaned
doctor_warning
```

`payload_json` must be redacted.

### settings

Key-value settings.

```sql
CREATE TABLE settings (
  key                 TEXT PRIMARY KEY,
  value_json          TEXT NOT NULL,
  updated_at          INTEGER NOT NULL
);
```

Initial settings:

```json
{
  "default_strategy": "quota-weighted",
  "reserve_pct": 5,
  "poll_interval_minutes": 5,
  "quota_mode": "fallback-first",
  "raw_log_persistence": false,
  "live_tail_lines": 200,
  "stale_lock_ttl_seconds": 120
}
```

### selector_cursor

Stores round-robin cursor independently from settings.

```sql
CREATE TABLE selector_cursor (
  key                 TEXT PRIMARY KEY,
  account_id          TEXT,
  updated_at          INTEGER NOT NULL
);
```

V1 key:

```text
default
```

Future keys can support workspace/model-specific cursors.

### limit_cooldowns

Stores transient cooldowns that should not mark account as exhausted.

```sql
CREATE TABLE limit_cooldowns (
  account_id          TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  reason              TEXT NOT NULL,
  until_at            INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);
```

Used for `Rate limited:` style signals.

## Indexes

```sql
CREATE INDEX idx_accounts_order ON accounts(order_index);
CREATE INDEX idx_quota_account_fetched ON quota_snapshots(account_id, fetched_at DESC);
CREATE INDEX idx_sessions_account_started ON sessions(account_id, started_at DESC);
CREATE INDEX idx_events_at ON events(at DESC);
CREATE INDEX idx_events_account_at ON events(account_id, at DESC);
```

## Derived Views

Latest quota:

```sql
CREATE VIEW latest_quota_snapshots AS
SELECT q.*
FROM quota_snapshots q
JOIN (
  SELECT account_id, MAX(fetched_at) AS max_fetched_at
  FROM quota_snapshots
  GROUP BY account_id
) latest
ON latest.account_id = q.account_id
AND latest.max_fetched_at = q.fetched_at;
```

Account status for UI is derived from:

- `accounts.enabled`
- `accounts.status`
- live `profile_locks`
- latest quota snapshot
- `limit_cooldowns`

## Migration Strategy

- Forward-only SQL files.
- Migration table stores filename, checksum, applied timestamp.
- Checksum mismatch aborts startup.
- Phase 2 creates `001_init.sql`.

```sql
CREATE TABLE schema_migrations (
  version             TEXT PRIMARY KEY,
  checksum            TEXT NOT NULL,
  applied_at          INTEGER NOT NULL
);
```

## Redaction Rules

Before writing JSON payloads:

- Drop known secret keys.
- Replace JWT-like values with `[REDACTED_JWT]`.
- Replace Authorization values with `[REDACTED_AUTH]`.
- Truncate large payloads to bounded size.

Known secret keys:

```text
windsurf_api_key
access_token
refresh_token
authorization
cookie
set-cookie
```

## Data Retention

V1 defaults:

- Session summaries retained indefinitely unless user purges.
- Events retained 30 days by default.
- Raw output not persisted.
- Quota snapshots retained 90 days by default.

Retention is enforced by `dsw doctor` and service startup cleanup.
