import os from 'node:os';
import type Database from 'better-sqlite3';
import { recordEvent } from '../events/log';

export interface ProfileLock {
  account_id: string;
  session_id: string | null;
  host: string;
  pid: number;
  acquired_at: number;
  heartbeat_at: number;
}

export function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function cleanupStaleLocks(db: Database.Database, now = Math.floor(Date.now() / 1000), ttlSeconds = 120): number {
  const locks = db.prepare('SELECT * FROM profile_locks').all() as ProfileLock[];
  let cleaned = 0;
  for (const lock of locks) {
    if (now - lock.heartbeat_at <= ttlSeconds) {
      continue;
    }
    if (pidIsAlive(lock.pid)) {
      continue;
    }
    db.prepare('DELETE FROM profile_locks WHERE account_id = ?').run(lock.account_id);
    recordEvent(db, {
      kind: 'stale_lock_cleaned',
      accountId: lock.account_id,
      sessionId: lock.session_id,
      at: now,
      payload: { pid: lock.pid, heartbeat_at: lock.heartbeat_at }
    });
    cleaned += 1;
  }
  return cleaned;
}

export function acquireProfileLock(
  db: Database.Database,
  accountId: string,
  sessionId: string,
  pid: number,
  now = Math.floor(Date.now() / 1000)
): void {
  db.prepare(
    `INSERT INTO profile_locks
      (account_id, session_id, host, pid, acquired_at, heartbeat_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(accountId, sessionId, os.hostname(), pid, now, now);
  recordEvent(db, { kind: 'profile_lock_acquired', accountId, sessionId, at: now, payload: { pid } });
}

export function heartbeatProfileLock(db: Database.Database, accountId: string, now = Math.floor(Date.now() / 1000)): void {
  db.prepare('UPDATE profile_locks SET heartbeat_at = ? WHERE account_id = ?').run(now, accountId);
}

export function releaseProfileLock(db: Database.Database, accountId: string): void {
  db.prepare('DELETE FROM profile_locks WHERE account_id = ?').run(accountId);
  recordEvent(db, { kind: 'profile_lock_released', accountId });
}
