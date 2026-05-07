import { readQuotaForAccount } from '../../core/quota';
import { pickBestAccountByQuota, runDevinForAccount } from '../../core/runner';
import { AccountStore } from '../../core/store';
import { formatTimestamp } from '../../util/format';

export interface DefaultCommandOptions {
  args: string[];
}

export async function runDefault(options: DefaultCommandOptions): Promise<void> {
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.error('No Devin accounts configured. Run `dsw add <name>` to add one.');
    process.exitCode = 1;
    return;
  }

  process.stderr.write('Checking quota...\n');
  const quotas = await Promise.all(accounts.filter((account) => !account.needsLogin).map((account) => readQuotaForAccount(account)));
  const picked = pickBestAccountByQuota(accounts, quotas);
  if (!picked) {
    console.error('No eligible accounts. All accounts need login or have exhausted quota.');
    process.exitCode = 1;
    return;
  }

  const quota = quotas.find((result) => result.account.id === picked.id);
  const remaining = quota?.summary.remainingPercent ? `, quota remaining: ${quota.summary.remainingPercent}` : '';
  process.stderr.write(`Selected ${picked.name} (last used: ${formatTimestamp(picked.lastUsedAt)}${remaining})\n`);
  const exitCode = await runDevinForAccount(store, picked, { args: options.args });
  process.exitCode = exitCode ?? 0;
}
