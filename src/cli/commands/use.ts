import { runDevinForAccount } from '../../core/runner';
import { AccountStore } from '../../core/store';
import { formatTimestamp } from '../../util/format';

export interface UseCommandOptions {
  name: string;
  args: string[];
}

export async function runUse(options: UseCommandOptions): Promise<void> {
  const store = new AccountStore();
  const account = store.getByName(options.name);

  if (account.needsLogin) {
    console.error(`Account ${account.name} needs login. Run \`dsw login ${account.name}\` to fix.`);
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`Selected ${account.name} (last used: ${formatTimestamp(account.lastUsedAt)})\n`);
  const exitCode = await runDevinForAccount(store, account, { args: options.args, autoRotate: false });
  process.exitCode = exitCode ?? 0;
}
