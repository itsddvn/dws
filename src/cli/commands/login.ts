import { AccountStore } from '../../core/store';
import { finalizeLogin } from './_shared';

export async function runLogin(name: string): Promise<void> {
  const store = new AccountStore();
  const account = store.getByName(name);

  console.log(`Re-running \`devin auth login\` for ${account.name}...`);
  let result;
  try {
    result = await finalizeLogin(store, account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Login failed: ${message}`);
    store.markNeedsLogin(account.id);
    process.exitCode = 1;
    return;
  }

  if (!result.loggedIn) {
    store.markNeedsLogin(account.id);
    console.error(`Login did not complete for ${account.name}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`${account.name} is logged in${result.email ? ` (${result.email})` : ''}.`);
}
