import { readQuotaForAccount } from '../../core/quota';
import { readQuotaCache, writeQuotaCache } from '../../core/quota-cache';
import { AccountStore } from '../../core/store';
import { renderTable } from '../../util/format';

export async function runQuota(): Promise<void> {
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.log('No Devin accounts configured. Run `dsw add <name>` to add one.');
    return;
  }

  const results = await Promise.all(accounts.map((account) => readQuotaForAccount(account)));
  const cache = readQuotaCache();
  writeQuotaCache(cache, results.filter((result) => result.status === 'ok' || result.status === 'exhausted'));

  const rows = results.map((result) => [
    result.account.name,
    formatStatus(result),
    result.summary.tier ?? '',
    result.summary.usedPercent ?? '',
    result.summary.remainingPercent ?? '',
    result.summary.resetsIn ?? '',
    result.summary.resetAt ?? ''
  ]);

  console.log(renderTable(['name', 'status', 'tier', 'used', 'remaining', 'resets in', 'reset at'], rows));

  for (const result of results) {
    if (result.status !== 'error' && result.status !== 'timeout') continue;
    const raw = result.rawRedacted ? `\n${indent(result.rawRedacted)}` : '';
    console.error(`\n${result.account.name}: failed to read usage${raw}`);
  }

  if (results.some((result) => result.status === 'error' || result.status === 'timeout')) {
    process.exitCode = 1;
  }
}

function formatStatus(result: Awaited<ReturnType<typeof readQuotaForAccount>>): string {
  if (result.status === 'needs-login') return 'needs login';
  if (result.status === 'exhausted') return 'exhausted';
  if (result.status === 'timeout') return 'timeout';
  if (result.status === 'error') return result.exitCode === null ? 'error' : `error ${result.exitCode}`;
  return 'ok';
}

function indent(value: string): string {
  return value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}
