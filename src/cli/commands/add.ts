import { ensureProfileDirs, removeProfileDir } from '../../core/profile-paths';
import { AccountStore, type Account } from '../../core/store';
import { slugifyAccountName } from '../../util/account-name';
import { finalizeLogin } from './_shared';

export async function runAdd(name?: string): Promise<void> {
  const store = new AccountStore();
  const explicitName = name?.trim();
  const account = store.create(explicitName || uniqueAccountName(store, `pending-${Date.now()}`));
  ensureProfileDirs(account.id);

  console.log(`Created profile ${explicitName || 'for new account'}. Launching \`devin auth login\`...`);
  let result;
  try {
    result = await finalizeLogin(store, account.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Login failed: ${message}`);
    rollback(store, account.id);
    process.exitCode = 1;
    return;
  }

  if (!result.loggedIn) {
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

  const finalName = explicitName ? account.name : applyAuthStatusName(store, account, result.name, result.email);
  if (!finalName) {
    process.exitCode = 1;
    return;
  }
  console.log(`Added ${finalName}${result.email ? ` (${result.email})` : ''}.`);
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

/**
 * Rename a freshly-created account using the name reported by
 * `devin auth status`, falling back to the email local-part. Returns the
 * resolved account name, or `null` (after rolling back) when no usable
 * name could be derived.
 */
function applyAuthStatusName(store: AccountStore, account: Account, name: string | null, email: string | null): string | null {
  const source = name ?? email?.split('@')[0] ?? null;
  const detected = slugifyAccountName(source);
  if (!detected) {
    rollback(store, account.id);
    console.error('Could not detect account name after login. Run `dsw add <name>` instead.');
    return null;
  }
  const renamed = store.rename(account.id, uniqueAccountName(store, detected, account.id));
  return renamed.name;
}

function uniqueAccountName(store: AccountStore, base: string, excludeId?: string): string {
  const existing = new Set(store.list().filter((account) => account.id !== excludeId).map((account) => account.name));
  if (!existing.has(base)) return base;

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
}
