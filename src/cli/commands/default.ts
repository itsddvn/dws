import { refreshAllQuotas } from '../../core/quota';
import { pickAccountByQuota, runDevinForAccount } from '../../core/runner';
import { AccountStore } from '../../core/store';
import { formatPercent } from '../../util/format';

export interface DefaultCommandOptions {
  args: string[];
  skipRefresh?: boolean;
}

export async function runDefault(options: DefaultCommandOptions): Promise<void> {
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.error('No Devin accounts configured. Run `dsw add <name>` to add one.');
    process.exitCode = 1;
    return;
  }

  if (!options.skipRefresh) {
    process.stderr.write('Refreshing quota for all accounts...\n');
    const results = await refreshAllQuotas(store);
    for (const result of results) {
      if (result.error) {
        process.stderr.write(`  ${result.account.name}: ${result.needsLogin ? 'needs login' : result.error}\n`);
      } else {
        const daily = formatPercent(result.quota?.dailyRemainingPct ?? null);
        const weekly = formatPercent(result.quota?.weeklyRemainingPct ?? null);
        process.stderr.write(`  ${result.account.name}: daily=${daily} weekly=${weekly}\n`);
      }
    }
  }

  const refreshed = store.list();
  const picked = pickAccountByQuota(refreshed);
  if (!picked) {
    console.error('No eligible accounts. All accounts need login or have no quota data.');
    process.exitCode = 1;
    return;
  }

  const quota = picked.quota;
  const daily = formatPercent(quota?.dailyRemainingPct ?? null);
  const weekly = formatPercent(quota?.weeklyRemainingPct ?? null);
  process.stderr.write(`Selected ${picked.name} (daily=${daily} weekly=${weekly})\n`);

  const exitCode = await runDevinForAccount(store, picked, { args: options.args });
  process.exitCode = exitCode ?? 0;
}
