import { readQuotaForAccount } from './quota';
import { pickBestAccountByQuota } from './runner';
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

      const candidates = this.store.list().filter((account) => account.id !== request.current.id && !account.needsLogin);
      const quotas = await Promise.all(
        candidates.map((account) =>
          readQuotaForAccount(account, {
            baseEnv: this.baseEnv,
            prepareRuntime: false
          })
        )
      );
      return { account: pickBestAccountByQuota(candidates, quotas) };
    } finally {
      this.rotating = false;
    }
  }
}
