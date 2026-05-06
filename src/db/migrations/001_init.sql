CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  order_index INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_reason TEXT,
  limited_until INTEGER,
  tier TEXT,
  plan_name TEXT,
  email TEXT,
  team_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_selected_at INTEGER,
  last_used_at INTEGER
);

CREATE TABLE quota_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  fetched_at INTEGER NOT NULL,
  source TEXT NOT NULL,
  daily_remaining_pct REAL,
  weekly_remaining_pct REAL,
  daily_reset_at INTEGER,
  weekly_reset_at INTEGER,
  used_prompt_credits REAL,
  available_prompt_credits REAL,
  used_flow_credits REAL,
  available_flow_credits REAL,
  used_flex_credits REAL,
  available_flex_credits REAL,
  raw_json TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  pid INTEGER,
  devin_session_id TEXT,
  finish_reason TEXT,
  exit_code INTEGER,
  strategy TEXT NOT NULL,
  command_summary TEXT,
  notes TEXT
);

CREATE TABLE profile_locks (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id),
  host TEXT NOT NULL,
  pid INTEGER NOT NULL,
  acquired_at INTEGER NOT NULL,
  heartbeat_at INTEGER NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT,
  session_id TEXT,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE selector_cursor (
  key TEXT PRIMARY KEY,
  account_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE limit_cooldowns (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  until_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_accounts_order ON accounts(order_index);
CREATE INDEX idx_quota_account_fetched ON quota_snapshots(account_id, fetched_at DESC);
CREATE INDEX idx_sessions_account_started ON sessions(account_id, started_at DESC);
CREATE INDEX idx_events_at ON events(at DESC);
CREATE INDEX idx_events_account_at ON events(account_id, at DESC);

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
