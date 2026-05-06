import { removeProfileDir } from '../../core/profile-paths';
import { AccountStore } from '../../core/store';

export interface RemoveCommandOptions {
  yes?: boolean;
}

export function runRemove(name: string, options: RemoveCommandOptions = {}): void {
  if (!options.yes) {
    console.error(`Refusing to remove ${name} without --yes. Re-run as: dsw remove ${name} --yes`);
    process.exitCode = 1;
    return;
  }

  const store = new AccountStore();
  const account = store.findByName(name);
  if (!account) {
    console.error(`Account not found: ${name}`);
    process.exitCode = 1;
    return;
  }

  store.remove(name);
  removeProfileDir(account.id);
  console.log(`Removed ${name}.`);
}
