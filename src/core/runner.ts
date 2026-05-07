import { spawn } from 'node:child_process';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { buildProfileEnv } from './profile-env';
import { persistProfileRuntime } from './profile-runtime';
import type { Account, AccountStore } from './store';

export interface RunDevinOptions {
  args: string[];
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
}

export async function runDevinForAccount(store: AccountStore, account: Account, options: RunDevinOptions): Promise<number | null> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const baseEnv = options.baseEnv ?? process.env;
  store.touchLastUsed(account.id);

  return await new Promise((resolve, reject) => {
    const child = spawn('devin', options.args, {
      env: buildProfileEnv(account.id, appPaths, baseEnv),
      stdio: 'inherit'
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
 * Pick the next eligible account in configured list order. The current account
 * is inferred from the most recently used account, then selection wraps.
 */
export function pickNextAccountInList(accounts: Account[]): Account | null {
  const eligible = accounts.filter((account) => !account.needsLogin);
  if (eligible.length === 0) return null;

  const currentIndex = findMostRecentlyUsedIndex(accounts);
  if (currentIndex === -1) return eligible[0]!;

  for (let offset = 1; offset <= accounts.length; offset += 1) {
    const candidate = accounts[(currentIndex + offset) % accounts.length]!;
    if (!candidate.needsLogin) return candidate;
  }

  return null;
}

function compareLeastRecentlyUsed(left: Account, right: Account): number {
  const leftLast = left.lastUsedAt ?? 0;
  const rightLast = right.lastUsedAt ?? 0;
  if (leftLast !== rightLast) return leftLast - rightLast;
  // Tie break: created earlier first (deterministic).
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.name.localeCompare(right.name);
}

function findMostRecentlyUsedIndex(accounts: Account[]): number {
  let bestIndex = -1;
  let bestLastUsed = -1;

  accounts.forEach((account, index) => {
    const lastUsed = account.lastUsedAt ?? -1;
    if (lastUsed > bestLastUsed) {
      bestIndex = index;
      bestLastUsed = lastUsed;
    }
  });

  return bestIndex;
}
