import { AccountStore } from '../../core/store';
import { formatPercent, formatTimestamp, renderTable } from '../../util/format';

export function runList(): void {
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.log('No Devin accounts configured. Run `dsw add <name>` to add one.');
    return;
  }

  const rows = accounts.map((account) => [
    account.name,
    account.needsLogin ? 'needs login' : 'ready',
    account.email ?? '',
    account.tier ?? '',
    account.plan ?? '',
    formatPercent(account.quota?.dailyRemainingPct ?? null),
    formatPercent(account.quota?.weeklyRemainingPct ?? null),
    formatTimestamp(account.lastUsedAt)
  ]);

  console.log(renderTable(['name', 'status', 'email', 'tier', 'plan', 'daily', 'weekly', 'last used'], rows));
}
