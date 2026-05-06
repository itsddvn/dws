import { readAuthStatus, runDevinLogin } from '../../core/auth';
import { readProfileOrgId } from '../../core/profile-config';
import { ensureProfileDirs, removeProfileDir } from '../../core/profile-paths';
import { AccountStore } from '../../core/store';

export async function runAdd(name: string): Promise<void> {
  const store = new AccountStore();
  const account = store.create(name);
  ensureProfileDirs(account.id);

  console.log(`Created profile ${account.name}. Launching \`devin auth login\`...`);
  try {
    await runDevinLogin(account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Login failed: ${message}`);
    rollback(store, account.id);
    process.exitCode = 1;
    return;
  }

  const status = await readAuthStatus(account.id);
  if (!status.loggedIn) {
    console.error(`Login did not complete for ${account.name}. Run \`dsw login ${account.name}\` to retry.`);
    store.markNeedsLogin(account.id);
    process.exitCode = 1;
    return;
  }

  store.setAuthMetadata(account.id, {
    email: status.email ?? null,
    tier: status.tier ?? null,
    plan: status.plan ?? null,
    orgId: readProfileOrgId(account.id)
  });
  console.log(`Added ${account.name}${status.email ? ` (${status.email})` : ''}.`);
}

function rollback(store: AccountStore, id: string): void {
  try {
    const account = store.list().find((entry) => entry.id === id);
    if (account) store.remove(account.name);
  } catch {
    // ignore
  }
  removeProfileDir(id);
}
