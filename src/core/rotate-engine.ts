import { isKnownFreeAccount, isTrialAccount } from './account-eligibility';
import { readQuotaForAccount } from './quota';
import type { AccountQuota } from './quota';
import type { Account, AccountStore } from './store';

export interface RotateRequest {
  current: Account;
  manual: boolean;
  sessionId: string | null;
}

export interface RotateResult {
  account: Account | null;
  reason?: string;
}

export class RotateEngine {
  private rotating = false;

  constructor(
    private readonly store: AccountStore,
    private readonly baseEnv: NodeJS.ProcessEnv = process.env
  ) {}

  async rotate(request: RotateRequest): Promise<RotateResult> {
    if (this.rotating) return { account: null, reason: 'rotation already in progress' };
    this.rotating = true;
    try {
      if (!request.sessionId) return { account: null, reason: 'no Devin session id available' };
      if (!request.manual) {
        const currentQuota = await readQuotaForAccount(request.current, {
          baseEnv: this.baseEnv,
          prepareRuntime: false
        });
        const remaining = Number.parseFloat(currentQuota.summary.remainingPercent ?? 'NaN');
        if (currentQuota.status !== 'exhausted' && Number.isFinite(remaining) && remaining > 0) {
          return { account: null, reason: 'quota is not exhausted' };
        }
      }

      const candidates = this.store
        .list()
        .filter((account) => account.id !== request.current.id && !account.needsLogin && !isKnownFreeAccount(account));
      const quotas = await Promise.all(
        candidates.map((account) =>
          readQuotaForAccount(account, {
            baseEnv: this.baseEnv,
            prepareRuntime: false
          })
        )
      );
      const account = pickBestAccountWithPositiveQuota(candidates, quotas);
      return account ? { account } : { account: null, reason: 'không còn tài khoản nào còn đủ quota, vui lòng add thêm' };
    } finally {
      this.rotating = false;
    }
  }
}

function pickBestAccountWithPositiveQuota(accounts: Account[], quotas: AccountQuota[]): Account | null {
  const quotaById = new Map(quotas.map((quota) => [quota.account.id, quota]));
  return accounts
    .map((account) => {
      const quota = quotaById.get(account.id);
      return { account, quota, remaining: parsePercent(quota?.summary.remainingPercent) };
    })
    .filter(
      (candidate): candidate is { account: Account; quota: AccountQuota; remaining: number } =>
        candidate.quota !== undefined &&
        isTrialAccount(candidate.account, candidate.quota) &&
        candidate.remaining !== null &&
        candidate.remaining > 0
    )
    .sort((left, right) => {
      if (left.remaining !== right.remaining) return right.remaining - left.remaining;
      return compareLeastRecentlyUsed(left.account, right.account);
    })[0]?.account ?? null;
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareLeastRecentlyUsed(left: Account, right: Account): number {
  const leftLast = left.lastUsedAt ?? 0;
  const rightLast = right.lastUsedAt ?? 0;
  if (leftLast !== rightLast) return leftLast - rightLast;
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.name.localeCompare(right.name);
}
