import { refreshAccountQuota, refreshAllQuotas } from '../../core/quota';
import { AccountStore } from '../../core/store';
import { formatCredits, formatPercent, renderTable } from '../../util/format';

export interface QuotaCommandOptions {
  name?: string;
  raw?: boolean;
}

export async function runQuota(options: QuotaCommandOptions = {}): Promise<void> {
  const store = new AccountStore();
  const allAccounts = store.list();
  if (allAccounts.length === 0) {
    console.log('No Devin accounts configured. Run `dsw add <name>` to add one.');
    return;
  }

  const results = options.name
    ? [await refreshAccountQuota(store, store.getByName(options.name))]
    : await refreshAllQuotas(store);

  const rows = results.map((result) => {
    const quota = result.quota;
    return [
      result.account.name,
      result.error ? (result.needsLogin ? 'needs login' : 'error') : 'ok',
      formatPercent(quota?.dailyRemainingPct ?? null),
      formatPercent(quota?.weeklyRemainingPct ?? null),
      formatCredits(quota?.usedPromptCredits ?? null, quota?.availablePromptCredits ?? null),
      formatCredits(quota?.usedFlowCredits ?? null, quota?.availableFlowCredits ?? null),
      formatCredits(quota?.usedFlexCredits ?? null, quota?.availableFlexCredits ?? null)
    ];
  });

  console.log(renderTable(['name', 'status', 'daily', 'weekly', 'prompt', 'flow', 'flex'], rows));

  for (const result of results) {
    if (result.error && !result.needsLogin) {
      console.error(`# ${result.account.name}: ${result.error}`);
    }
    if (options.raw && result.quota?.rawOutput) {
      console.log('');
      console.log(`${result.account.name} /usage output:`);
      console.log(result.quota.rawOutput);
    }
  }
}
