import { readQuotaForAccount } from '../../core/quota';
import {
  invalidateQuotaCacheEntry,
  isCacheBypassed,
  mergeAccountQuotaWithCache,
  readQuotaCache,
  writeQuotaCache
} from '../../core/quota-cache';
import { pickBestAccountByQuota, runDevinForAccount } from '../../core/runner';
import { AccountStore } from '../../core/store';
import { readAuthStatus, runDevinLogin } from '../../core/auth';
import { readProfileOrgId } from '../../core/profile-config';
import { ensureProfileDirs } from '../../core/profile-paths';
import { formatTimestamp } from '../../util/format';

export interface QuotaPickRunOptions {
  args: string[];
  /** Optional override for testing. */
  baseEnv?: NodeJS.ProcessEnv;
}

/**
 * Default `dsw` implementation: check quota across all ready accounts, pick
 * the one with the most remaining quota, run devin under it.
 */
export async function runWithQuotaPick(options: QuotaPickRunOptions): Promise<void> {
  const env = options.baseEnv ?? process.env;
  const store = new AccountStore();
  const accounts = store.list();
  if (accounts.length === 0) {
    console.error('No Devin accounts configured. Run `dsw add <name>` to add one.');
    process.exitCode = 1;
    return;
  }

  const ready = accounts.filter((account) => !account.needsLogin);
  let quotas: Awaited<ReturnType<typeof readQuotaForAccount>>[] = [];

  if (isCacheBypassed(env)) {
    process.stderr.write('Skipping quota check (DSW_SKIP_QUOTA=1)\n');
  } else if (ready.length > 0) {
    process.stderr.write('Checking quota...\n');
    const cache = readQuotaCache();
    const { fresh, stale } = mergeAccountQuotaWithCache(ready, cache, env);
    const refreshed = await Promise.all(stale.map((account) => readQuotaForAccount(account, { baseEnv: env })));
    if (refreshed.some((result) => result.status === 'error' && /pty unavailable/i.test(result.rawRedacted))) {
      process.stderr.write('dsw: warning: PTY quota probe unavailable; falling back to least-recently-used selection.\n');
    }
    quotas = [...fresh, ...refreshed];
    writeQuotaCache(cache, refreshed);
  }

  const picked = pickBestAccountByQuota(accounts, quotas);
  if (!picked) {
    console.error('No eligible accounts. All accounts need login or have exhausted quota.');
    process.exitCode = 1;
    return;
  }

  const quota = quotas.find((result) => result.account.id === picked.id);
  const remaining = quota?.summary.remainingPercent ? `, quota remaining: ${quota.summary.remainingPercent}` : '';
  process.stderr.write(`Selected ${picked.name} (last used: ${formatTimestamp(picked.lastUsedAt)}${remaining})\n`);
  const exitCode = await runDevinForAccount(store, picked, { args: options.args, autoRotate: true });
  // The selected account just consumed quota; drop its cache entry so the
  // next `dsw` invocation re-checks instead of trusting a stale value.
  invalidateQuotaCacheEntry(picked.id);
  process.exitCode = exitCode ?? 0;
}

export interface FinalizeLoginResult {
  loggedIn: boolean;
  email: string | null;
  name: string | null;
}

/**
 * Run `devin auth login` for the given profile id, then read auth status
 * and persist the resulting metadata. Returns `loggedIn=false` when login
 * did not complete; the caller decides what to do (e.g. mark needs-login,
 * roll back).
 */
export async function finalizeLogin(store: AccountStore, accountId: string): Promise<FinalizeLoginResult> {
  ensureProfileDirs(accountId);
  await runDevinLogin(accountId);

  const status = await readAuthStatus(accountId);
  if (!status.loggedIn) return { loggedIn: false, email: null, name: null };

  store.setAuthMetadata(accountId, {
    email: status.email ?? null,
    tier: status.tier ?? null,
    plan: status.plan ?? null,
    orgId: readProfileOrgId(accountId)
  });
  return { loggedIn: true, email: status.email ?? null, name: status.name ?? null };
}
