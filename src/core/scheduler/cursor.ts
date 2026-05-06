import type Database from 'better-sqlite3';

export function getCursor(db: Database.Database, key = 'default'): string | undefined {
  const row = db.prepare('SELECT account_id FROM selector_cursor WHERE key = ?').get(key) as { account_id?: string } | undefined;
  return row?.account_id;
}

export function setCursor(db: Database.Database, accountId: string, key = 'default'): void {
  db.prepare(
    `INSERT INTO selector_cursor (key, account_id, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at`
  ).run(key, accountId, Math.floor(Date.now() / 1000));
}
