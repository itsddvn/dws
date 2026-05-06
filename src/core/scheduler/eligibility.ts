import type Database from 'better-sqlite3';
import type { Account } from '../accounts/service';
import { cleanupStaleLocks } from '../runner/locks';

export interface EligibleAccount extends Account {
  daily_remaining_pct?: number | null;
  weekly_remaining_pct?: number | null;
}

interface LatestQuotaRow {
  account_id: string;
  daily_remaining_pct: number | null;
  weekly_remaining_pct: number | null;
}

export function getEligibleAccounts(db: Database.Database, reservePct = 5): EligibleAccount[] {
  cleanupStaleLocks(db);

  const accounts = db.prepare('SELECT * FROM accounts ORDER BY order_index ASC, name ASC').all() as Account[];
  const quotaRows = db.prepare('SELECT account_id, daily_remaining_pct, weekly_remaining_pct FROM latest_quota_snapshots').all() as LatestQuotaRow[];
  const quotaByAccount = new Map(quotaRows.map((row) => [row.account_id, row]));
  const locked = new Set((db.prepare('SELECT account_id FROM profile_locks').all() as Array<{ account_id: string }>).map((row) => row.account_id));
  const now = Math.floor(Date.now() / 1000);

  return accounts
    .filter((account) => account.enabled === 1)
    .filter((account) => account.status === 'ready' || account.status === 'unknown')
    .filter((account) => !locked.has(account.id))
    .filter((account) => !account.limited_until || account.limited_until <= now)
    .map((account) => ({ ...account, ...quotaByAccount.get(account.id) }))
    .filter((account) => quotaOk(account.daily_remaining_pct, reservePct))
    .filter((account) => quotaOk(account.weekly_remaining_pct, reservePct));
}

function quotaOk(value: number | null | undefined, reservePct: number): boolean {
  return value === null || value === undefined || value > reservePct;
}
