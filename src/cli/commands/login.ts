import { readAuthStatus, runDevinLogin } from '../../core/auth';
import { readProfileOrgId } from '../../core/profile-config';
import { ensureProfileDirs } from '../../core/profile-paths';
import { AccountStore } from '../../core/store';

export async function runLogin(name: string): Promise<void> {
  const store = new AccountStore();
  const account = store.getByName(name);
  ensureProfileDirs(account.id);

  console.log(`Re-running \`devin auth login\` for ${account.name}...`);
  try {
    await runDevinLogin(account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Login failed: ${message}`);
    store.markNeedsLogin(account.id);
    process.exitCode = 1;
    return;
  }

  const status = await readAuthStatus(account.id);
  if (!status.loggedIn) {
    store.markNeedsLogin(account.id);
    console.error(`Login did not complete for ${account.name}.`);
    process.exitCode = 1;
    return;
  }

  store.setAuthMetadata(account.id, {
    email: status.email ?? null,
    tier: status.tier ?? null,
    plan: status.plan ?? null,
    orgId: readProfileOrgId(account.id)
  });
  console.log(`${account.name} is logged in${status.email ? ` (${status.email})` : ''}.`);
}
