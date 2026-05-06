import crypto from 'node:crypto';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { openAppDatabase } from '../../db/client';
import { recordEvent } from '../events/log';
import { ensureProfileDirs, resolveProfilePaths } from '../profiles/paths';

export interface Account {
  id: string;
  name: string;
  order_index: number;
  enabled: number;
  status: string;
  status_reason?: string | null;
  limited_until?: number | null;
  tier?: string | null;
  plan_name?: string | null;
  email?: string | null;
  team_id?: string | null;
  created_at: number;
  updated_at: number;
}

export class AccountService {
  constructor(
    private readonly db: Database.Database = openAppDatabase(),
    private readonly appPaths: AppPaths = resolveAppPaths()
  ) {}

  create(name: string): Account {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Account name is required');
    }
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const maxOrder = this.db.prepare('SELECT COALESCE(MAX(order_index), -1) AS maxOrder FROM accounts').get() as {
      maxOrder: number;
    };
    const orderIndex = maxOrder.maxOrder + 1;

    this.db
      .prepare(
        `INSERT INTO accounts
          (id, name, order_index, enabled, status, created_at, updated_at)
         VALUES (?, ?, ?, 1, 'unknown', ?, ?)`
      )
      .run(id, cleanName, orderIndex, now, now);
    ensureProfileDirs(id, this.appPaths);
    recordEvent(this.db, { kind: 'account_created', accountId: id, at: now, payload: { name: cleanName } });
    return this.getById(id);
  }

  getById(id: string): Account {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account | undefined;
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }
    return account;
  }

  getByName(name: string): Account {
    const account = this.db.prepare('SELECT * FROM accounts WHERE name = ?').get(name) as Account | undefined;
    if (!account) {
      throw new Error(`Account not found: ${name}`);
    }
    return account;
  }

  list(): Account[] {
    return this.db.prepare('SELECT * FROM accounts ORDER BY order_index ASC, name ASC').all() as Account[];
  }

  setEnabled(name: string, enabled: boolean): Account {
    const account = this.getByName(name);
    this.db
      .prepare('UPDATE accounts SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, Math.floor(Date.now() / 1000), account.id);
    recordEvent(this.db, {
      kind: enabled ? 'account_enabled' : 'account_disabled',
      accountId: account.id,
      payload: { name: account.name }
    });
    return this.getById(account.id);
  }

  updateAuthMetadata(accountId: string, metadata: { email?: string; tier?: string; plan?: string; teamId?: string }): Account {
    this.db
      .prepare(
        `UPDATE accounts
         SET email = COALESCE(?, email),
             tier = COALESCE(?, tier),
             plan_name = COALESCE(?, plan_name),
             team_id = COALESCE(?, team_id),
             status = 'ready',
             status_reason = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .run(metadata.email, metadata.tier, metadata.plan, metadata.teamId, Math.floor(Date.now() / 1000), accountId);
    recordEvent(this.db, { kind: 'auth_metadata_updated', accountId, payload: metadata });
    return this.getById(accountId);
  }

  markNeedsLogin(accountId: string, reason: string): Account {
    this.db
      .prepare('UPDATE accounts SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?')
      .run('needs_login', reason, Math.floor(Date.now() / 1000), accountId);
    recordEvent(this.db, { kind: 'mark_needs_login', accountId, payload: { reason } });
    return this.getById(accountId);
  }

  markLimited(name: string, reason: string, limitedUntil?: number | null): Account {
    const account = this.getByName(name);
    this.db
      .prepare('UPDATE accounts SET status = ?, status_reason = ?, limited_until = ?, updated_at = ? WHERE id = ?')
      .run('limited', reason, limitedUntil ?? null, Math.floor(Date.now() / 1000), account.id);
    recordEvent(this.db, {
      kind: 'manual_mark_limited',
      accountId: account.id,
      payload: { reason, limited_until: limitedUntil ?? null }
    });
    return this.getById(account.id);
  }

  unmark(name: string): Account {
    const account = this.getByName(name);
    this.db
      .prepare('UPDATE accounts SET status = ?, status_reason = NULL, limited_until = NULL, updated_at = ? WHERE id = ?')
      .run('ready', Math.floor(Date.now() / 1000), account.id);
    recordEvent(this.db, { kind: 'manual_unmark_limited', accountId: account.id });
    return this.getById(account.id);
  }

  markAccountLimited(accountId: string, reason: string, limitedUntil?: number | null): Account {
    this.db
      .prepare('UPDATE accounts SET status = ?, status_reason = ?, limited_until = ?, updated_at = ? WHERE id = ?')
      .run('limited', reason, limitedUntil ?? null, Math.floor(Date.now() / 1000), accountId);
    recordEvent(this.db, {
      kind: 'auto_mark_limited',
      accountId,
      payload: { reason, limited_until: limitedUntil ?? null }
    });
    return this.getById(accountId);
  }

  markReady(accountId: string): Account {
    this.db
      .prepare('UPDATE accounts SET status = ?, status_reason = NULL, limited_until = NULL, updated_at = ? WHERE id = ?')
      .run('ready', Math.floor(Date.now() / 1000), accountId);
    recordEvent(this.db, { kind: 'mark_ready', accountId });
    return this.getById(accountId);
  }

  remove(name: string): void {
    const account = this.getByName(name);
    const profilePaths = resolveProfilePaths(account.id, this.appPaths);
    const removeTx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
      recordEvent(this.db, { kind: 'account_removed', accountId: account.id, payload: { name: account.name } });
    });
    removeTx();
    fs.rmSync(profilePaths.rootDir, { recursive: true, force: true });
  }
}
