import { spawn } from 'node:child_process';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { buildProfileEnv } from './profile-env';
import type { Account, AccountStore } from './store';

export interface RunDevinOptions {
  args: string[];
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
}

export async function runDevinForAccount(store: AccountStore, account: Account, options: RunDevinOptions): Promise<number | null> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  store.touchLastUsed(account.id);

  return await new Promise((resolve, reject) => {
    const child = spawn('devin', options.args, {
      env: buildProfileEnv(account.id, appPaths, options.baseEnv ?? process.env),
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
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

function compareLeastRecentlyUsed(left: Account, right: Account): number {
  const leftLast = left.lastUsedAt ?? 0;
  const rightLast = right.lastUsedAt ?? 0;
  if (leftLast !== rightLast) return leftLast - rightLast;
  // Tie break: created earlier first (deterministic).
  if (left.createdAt !== right.createdAt) return left.createdAt - right.createdAt;
  return left.name.localeCompare(right.name);
}
