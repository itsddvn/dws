import { AccountStore } from '../../core/store';
import { formatTimestamp, renderTable } from '../../util/format';

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
    account.orgId ?? '',
    formatTimestamp(account.lastUsedAt)
  ]);

  console.log(renderTable(['name', 'status', 'email', 'tier', 'plan', 'org id', 'last used'], rows));
}
