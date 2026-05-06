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

export function pickAccountByQuota(accounts: Account[]): Account | null {
  const eligible = accounts.filter((account) => !account.needsLogin);
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareForSelection)[0]!;
}

function compareForSelection(left: Account, right: Account): number {
  const leftScore = scoreFor(left);
  const rightScore = scoreFor(right);
  if (leftScore !== rightScore) return rightScore - leftScore;
  // Prefer the least recently used (rotate fairly).
  const leftLast = left.lastUsedAt ?? 0;
  const rightLast = right.lastUsedAt ?? 0;
  if (leftLast !== rightLast) return leftLast - rightLast;
  return left.createdAt - right.createdAt;
}

function scoreFor(account: Account): number {
  const quota = account.quota;
  if (!quota) return -1;
  const daily = quota.dailyRemainingPct;
  const weekly = quota.weeklyRemainingPct;
  if (daily === null && weekly === null) return -1;
  if (daily === null) return weekly ?? -1;
  if (weekly === null) return daily;
  return Math.min(daily, weekly);
}
