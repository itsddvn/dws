import type Database from 'better-sqlite3';
import { getCursor, setCursor } from './cursor';
import { getEligibleAccounts, type EligibleAccount } from './eligibility';

export type SelectionStrategy = 'manual' | 'quota-weighted' | 'round-robin';

export function selectNextAccount(db: Database.Database, strategy: SelectionStrategy = 'quota-weighted'): EligibleAccount {
  const eligible = getEligibleAccounts(db);
  if (eligible.length === 0) {
    throw new Error('No eligible Devin profiles');
  }

  const selected =
    strategy === 'round-robin'
      ? selectRoundRobin(db, eligible)
      : strategy === 'manual'
        ? suggestManualAccount(eligible)
        : selectQuotaWeighted(eligible);
  setCursor(db, selected.id);
  db.prepare('UPDATE accounts SET last_selected_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), selected.id);
  return selected;
}

export function suggestManualAccount(accounts: EligibleAccount[]): EligibleAccount {
  return selectQuotaWeighted(accounts);
}

export function selectQuotaWeighted(accounts: EligibleAccount[]): EligibleAccount {
  return [...accounts].sort((left, right) => {
    const scoreDiff = quotaScore(right) - quotaScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return left.order_index - right.order_index;
  })[0] as EligibleAccount;
}

export function selectRoundRobin(db: Database.Database, accounts: EligibleAccount[]): EligibleAccount {
  const sorted = [...accounts].sort((left, right) => left.order_index - right.order_index);
  const cursor = getCursor(db);
  const cursorIndex = cursor ? sorted.findIndex((account) => account.id === cursor) : -1;
  return sorted[(cursorIndex + 1) % sorted.length] as EligibleAccount;
}

function quotaScore(account: EligibleAccount): number {
  return Math.min(account.daily_remaining_pct ?? 100, account.weekly_remaining_pct ?? 100);
}
