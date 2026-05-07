import { pickNextAccountInList, runDevinForAccount } from '../../core/runner';
import { AccountStore } from '../../core/store';
import { formatTimestamp } from '../../util/format';

export interface NextCommandOptions {
  args: string[];
}

export async function runNext(options: NextCommandOptions): Promise<void> {
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.error('No Devin accounts configured. Run `dsw add <name>` to add one.');
    process.exitCode = 1;
    return;
  }

  const picked = pickNextAccountInList(accounts);
  if (!picked) {
    console.error('No eligible accounts. All accounts need login. Run `dsw login <name>` to fix.');
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`Selected ${picked.name} (last used: ${formatTimestamp(picked.lastUsedAt)})\n`);
  const exitCode = await runDevinForAccount(store, picked, { args: options.args });
  process.exitCode = exitCode ?? 0;
}
