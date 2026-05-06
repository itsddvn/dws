import type Database from 'better-sqlite3';

export interface DefaultSettings {
  default_strategy: 'quota-weighted';
  reserve_pct: number;
  poll_interval_minutes: number;
  quota_mode: 'fallback-first';
  raw_log_persistence: false;
  live_tail_lines: number;
  stale_lock_ttl_seconds: number;
}

export const defaultSettings: DefaultSettings = {
  default_strategy: 'quota-weighted',
  reserve_pct: 5,
  poll_interval_minutes: 5,
  quota_mode: 'fallback-first',
  raw_log_persistence: false,
  live_tail_lines: 200,
  stale_lock_ttl_seconds: 120
};

export function seedDefaultSettings(db: Database.Database, now = Math.floor(Date.now() / 1000)): void {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insert.run(key, JSON.stringify(value), now);
  }
}
