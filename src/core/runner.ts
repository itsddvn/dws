import { spawn } from 'node:child_process';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { buildProfileEnv } from './profile-env';
import { persistProfileRuntime } from './profile-runtime';
import { getPtyAvailability, runDevinPtyForAccount } from './pty-runner';
import { isKnownFreeAccount, isTrialAccount } from './account-eligibility';
import type { AccountQuota } from './quota';
import type { Account, AccountStore } from './store';

export interface RunDevinOptions {
  args: string[];
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
  autoRotate?: boolean;
}

export async function runDevinForAccount(store: AccountStore, account: Account, options: RunDevinOptions): Promise<number | null> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const baseEnv = options.baseEnv ?? process.env;

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const pty = await getPtyAvailability(baseEnv);
    if (pty.available) {
      return await runDevinPtyForAccount(store, account, {
        args: options.args,
        appPaths,
        baseEnv,
        autoRotate: options.autoRotate ?? false
      });
    }
    process.stderr.write(`dsw: warning: PTY unavailable (${pty.reason ?? 'unknown'}); using legacy runner without auto-rotate.\n`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('devin', options.args, {
      env: buildProfileEnv(account.id, appPaths, baseEnv),
      stdio: 'inherit'
    });
    // Only mark the account as used once devin has actually started, so a
    // failed spawn (ENOENT / EACCES) does not skew LRU rotation.
    child.on('spawn', () => {
      store.touchLastUsed(account.id);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      persistProfileRuntime(account.id, appPaths, baseEnv);
      resolve(code);
    });
  });
}

/**
 * Pick the next account to run. Picks the least-recently-used eligible
 * account so accounts rotate fairly. Accounts that need login are skipped.
 */
export function pickNextAccount(accounts: Account[]): Account | null {
  const eligible = accounts.filter((account) => !account.needsLogin);
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareLeastRecentlyUsed)[0]!;
}

/**
 * Pick the best quota-available account for default runs. Accounts with known
 * positive remaining quota win by highest remaining percentage, then LRU.
 * Exhausted accounts are skipped when any usable or fallback account exists.
 */
export function pickBestAccountByQuota(accounts: Account[], quotas: AccountQuota[]): Account | null {
  const eligible = accounts.filter((account) => !account.needsLogin && !isKnownFreeAccount(account));
  if (eligible.length === 0) return null;

  const ranked = rankQuotaCandidates(eligible, quotas);
  const positive = ranked
    .filter((candidate) => candidate.usability === 'positive')
    .sort((left, right) => {
      if (left.remaining !== right.remaining) return right.remaining - left.remaining;
      return compareLeastRecentlyUsed(left.account, right.account);
    });
  if (positive[0]) return positive[0].account;

  const unknown = ranked
    .filter((candidate) => candidate.usability === 'unknown')
    .map((candidate) => candidate.account)
    .sort(compareLeastRecentlyUsed);
  if (unknown[0]) return unknown[0];

  const fallback = ranked
    .filter((candidate) => candidate.usability === 'fallback')
    .map((candidate) => candidate.account)
    .sort(compareLeastRecentlyUsed);
  if (fallback[0]) return fallback[0];

  return null;
}

interface QuotaCandidate {
  account: Account;
  usability: 'positive' | 'unknown' | 'fallback' | 'unavailable';
  remaining: number;
}

function rankQuotaCandidates(accounts: Account[], quotas: AccountQuota[]): QuotaCandidate[] {
  const quotaById = new Map(quotas.map((quota) => [quota.account.id, quota]));
  return accounts.map((account) => {
    const quota = quotaById.get(account.id);
    if (!quota) {
      return { account, usability: isTrialAccount(account, undefined) ? 'fallback' : 'unavailable', remaining: -1 };
    }

    const remaining = parsePercent(quota.summary.remainingPercent);
    if (remaining !== null && remaining <= 0) return { account, usability: 'unavailable', remaining };
    if (!isTrialAccount(account, quota)) return { account, usability: 'unavailable', remaining: remaining ?? -1 };

    if (quota.status === 'needs-login' || quota.status === 'exhausted') return { account, usability: 'unavailable', remaining: 0 };
    if (quota.status === 'error' || quota.status === 'timeout') return { account, usability: 'fallback', remaining: -1 };

    if (remaining === null) return { account, usability: 'unknown', remaining: -1 };
    return { account, usability: 'positive', remaining };
  });
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareLeastRecentlyUsed(left: Account, right: Account): number {
  const leftLast = left.lastUsedAt ?? 0;
  const rightLast = right.lastUsedAt ?? 0;
  if (leftLast !== rightLast) return leftLast - rightLast;
  // Tie break: created earlier first (deterministic).
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.name.localeCompare(right.name);
}
