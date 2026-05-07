import { readAuthStatus, runDevinLogin, type DevinAuthStatus } from '../../core/auth';
import { readProfileOrgId } from '../../core/profile-config';
import { ensureProfileDirs, removeProfileDir } from '../../core/profile-paths';
import { AccountStore, type Account } from '../../core/store';

export async function runAdd(name?: string): Promise<void> {
  const store = new AccountStore();
  const explicitName = name?.trim();
  const account = store.create(explicitName || uniqueAccountName(store, `pending-${Date.now()}`));
  ensureProfileDirs(account.id);

  console.log(`Created profile ${explicitName || 'for new account'}. Launching \`devin auth login\`...`);
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
    console.error(`Login did not complete${explicitName ? ` for ${account.name}` : ''}.`);
    if (explicitName) {
      console.error(`Run \`dsw login ${account.name}\` to retry.`);
      store.markNeedsLogin(account.id);
    } else {
      rollback(store, account.id);
    }
    process.exitCode = 1;
    return;
  }

  const namedAccount = explicitName ? account : renameFromAuthStatus(store, account, status);
  store.setAuthMetadata(namedAccount.id, {
    email: status.email ?? null,
    tier: status.tier ?? null,
    plan: status.plan ?? null,
    orgId: readProfileOrgId(namedAccount.id)
  });
  console.log(`Added ${namedAccount.name}${status.email ? ` (${status.email})` : ''}.`);
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

function renameFromAuthStatus(store: AccountStore, account: Account, status: DevinAuthStatus): Account {
  const detected = detectedAccountName(status);
  if (!detected) {
    rollback(store, account.id);
    throw new Error('Could not detect account name after login. Run `dsw add <name>` instead.');
  }
  return store.rename(account.id, uniqueAccountName(store, detected, account.id));
}

function detectedAccountName(status: DevinAuthStatus): string | null {
  const source = status.name || status.email?.split('@')[0];
  if (!source) return null;
  const slug = source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

function uniqueAccountName(store: AccountStore, base: string, excludeId?: string): string {
  const existing = new Set(store.list().filter((account) => account.id !== excludeId).map((account) => account.name));
  if (!existing.has(base)) return base;

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
}
