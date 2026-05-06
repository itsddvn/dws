import type Database from 'better-sqlite3';
import type { AccountService } from '../accounts/service';
import { recordEvent } from '../events/log';
import {
  fetchQuotaForProfile,
  QuotaAuthError,
  QuotaRateLimitError,
  type FetchQuotaOptions,
  type QuotaSnapshotInput
} from './endpoint';

export interface PollQuotaOptions extends FetchQuotaOptions {
  now?: number;
}

export class QuotaPoller {
  private readonly failureCounts = new Map<string, number>();
  private readonly nextAttemptAt = new Map<string, number>();

  constructor(
    private readonly db: Database.Database,
    private readonly accountService: AccountService,
    private readonly options: PollQuotaOptions = {}
  ) {}

  async poll(accountId: string, now = Math.floor(Date.now() / 1000)): Promise<QuotaSnapshotInput | null> {
    const nextAttempt = this.nextAttemptAt.get(accountId) ?? 0;
    if (now < nextAttempt) {
      recordEvent(this.db, {
        kind: 'quota_poll_backoff_skip',
        accountId,
        at: now,
        payload: { next_attempt_at: nextAttempt }
      });
      return null;
    }

    const snapshot = await pollQuotaForAccount(this.db, this.accountService, accountId, { ...this.options, now });
    if (snapshot) {
      this.failureCounts.delete(accountId);
      this.nextAttemptAt.delete(accountId);
      return snapshot;
    }

    const failures = (this.failureCounts.get(accountId) ?? 0) + 1;
    this.failureCounts.set(accountId, failures);
    this.nextAttemptAt.set(accountId, now + backoffSeconds(failures));
    if (failures >= 3) {
      recordEvent(this.db, {
        kind: 'quota_poll_circuit_open',
        accountId,
        at: now,
        payload: { failures, next_attempt_at: this.nextAttemptAt.get(accountId) }
      });
    }
    return null;
  }
}

export async function pollQuotaForAccount(
  db: Database.Database,
  accountService: AccountService,
  accountId: string,
  options: PollQuotaOptions = {}
): Promise<QuotaSnapshotInput | null> {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (!options.endpointUrl && !process.env.DSW_QUOTA_ENDPOINT_URL) {
    return null;
  }
  try {
    const snapshot = await fetchQuotaForProfile(accountId, options);
    insertQuotaSnapshot(db, accountId, snapshot, now);
    applyQuotaStatus(accountService, accountId, snapshot);
    recordEvent(db, {
      kind: 'quota_poll',
      accountId,
      at: now,
      payload: {
        daily_remaining_pct: snapshot.daily_remaining_pct,
        weekly_remaining_pct: snapshot.weekly_remaining_pct
      }
    });
    return snapshot;
  } catch (error) {
    if (error instanceof QuotaAuthError) {
      accountService.markNeedsLogin(accountId, error.message);
      recordEvent(db, { kind: 'quota_auth_failed', accountId, at: now, payload: { message: error.message } });
      return null;
    }
    if (error instanceof QuotaRateLimitError) {
      recordEvent(db, { kind: 'quota_rate_limited', accountId, at: now, payload: { message: error.message } });
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    recordEvent(db, { kind: 'quota_poll_failed', accountId, at: now, payload: { message } });
    return null;
  }
}

function backoffSeconds(failures: number): number {
  return Math.min(15 * 60, 2 ** Math.min(failures, 6));
}

export function insertQuotaSnapshot(
  db: Database.Database,
  accountId: string,
  snapshot: QuotaSnapshotInput,
  fetchedAt = Math.floor(Date.now() / 1000)
): void {
  db.prepare(
    `INSERT INTO quota_snapshots
      (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct,
       daily_reset_at, weekly_reset_at, used_prompt_credits, available_prompt_credits,
       used_flow_credits, available_flow_credits, used_flex_credits, available_flex_credits,
       raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    accountId,
    fetchedAt,
    snapshot.source,
    snapshot.daily_remaining_pct,
    snapshot.weekly_remaining_pct,
    snapshot.daily_reset_at,
    snapshot.weekly_reset_at,
    snapshot.used_prompt_credits,
    snapshot.available_prompt_credits,
    snapshot.used_flow_credits,
    snapshot.available_flow_credits,
    snapshot.used_flex_credits,
    snapshot.available_flex_credits,
    snapshot.raw_json
  );
}

function applyQuotaStatus(accountService: AccountService, accountId: string, snapshot: QuotaSnapshotInput): void {
  const account = accountService.getById(accountId);
  if (account.status === 'limited' && account.status_reason === 'manual') {
    return;
  }
  if (snapshot.daily_remaining_pct === 0 || snapshot.weekly_remaining_pct === 0) {
    const resetAt = minPositive(snapshot.daily_reset_at, snapshot.weekly_reset_at);
    accountService.markAccountLimited(accountId, 'quota_snapshot:zero_remaining', resetAt);
    return;
  }
  accountService.markReady(accountId);
}

function minPositive(...values: Array<number | null>): number | null {
  const positive = values.filter((value): value is number => typeof value === 'number' && value > 0);
  return positive.length ? Math.min(...positive) : null;
}
