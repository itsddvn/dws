import { resolveAppPaths, type AppPaths } from '../config/paths';
import { runCapture } from '../util/exec';
import { redactText } from '../util/redact';
import { buildProfileEnv } from './profile-env';
import type { Account, AccountStore, QuotaSnapshot } from './store';

export interface FetchQuotaOptions {
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
  runImpl?: typeof runCapture;
  timeoutMs?: number;
}

export class QuotaAuthError extends Error {
  constructor(message = 'devin /usage reported authentication failure') {
    super(message);
    this.name = 'QuotaAuthError';
  }
}

export async function fetchQuotaForProfile(profileId: string, options: FetchQuotaOptions = {}): Promise<QuotaSnapshot> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const runImpl = options.runImpl ?? runCapture;
  const result = await runImpl('devin', ['-p', '/usage'], {
    env: buildProfileEnv(profileId, appPaths, options.baseEnv ?? process.env),
    timeoutMs: options.timeoutMs ?? 60_000
  });
  const output = `${result.stdout}\n${result.stderr}`.trim();

  if (/not logged in|please log in|login required/i.test(output)) {
    throw new QuotaAuthError(`devin /usage requires login: ${redactText(output).slice(0, 200)}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(`devin /usage failed with exit code ${result.exitCode}: ${redactText(output)}`);
  }
  return parseUsageOutput(output);
}

export function parseUsageOutput(output: string): QuotaSnapshot {
  const redacted = redactText(output);
  const daily = findPercent(redacted, ['daily', 'day']);
  const weekly = findPercent(redacted, ['weekly', 'week']);
  const prompt = findCreditPair(redacted, ['prompt']);
  const flow = findCreditPair(redacted, ['flow', 'acu']);
  const flex = findCreditPair(redacted, ['flex']);

  return {
    fetchedAt: Math.floor(Date.now() / 1000),
    dailyRemainingPct: daily,
    weeklyRemainingPct: weekly,
    usedPromptCredits: prompt?.used ?? null,
    availablePromptCredits: prompt?.available ?? null,
    usedFlowCredits: flow?.used ?? null,
    availableFlowCredits: flow?.available ?? null,
    usedFlexCredits: flex?.used ?? null,
    availableFlexCredits: flex?.available ?? null,
    rawOutput: redacted
  };
}

export interface RefreshResult {
  account: Account;
  quota: QuotaSnapshot | null;
  error?: string;
  needsLogin?: boolean;
}

export async function refreshAccountQuota(
  store: AccountStore,
  account: Account,
  options: FetchQuotaOptions = {}
): Promise<RefreshResult> {
  try {
    const quota = await fetchQuotaForProfile(account.id, options);
    const updated = store.setQuota(account.id, quota);
    return { account: updated, quota };
  } catch (error) {
    if (error instanceof QuotaAuthError) {
      const updated = store.markNeedsLogin(account.id);
      return { account: updated, quota: null, error: error.message, needsLogin: true };
    }
    return { account, quota: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function refreshAllQuotas(
  store: AccountStore,
  options: FetchQuotaOptions = {}
): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];
  for (const account of store.list()) {
    if (account.needsLogin) {
      results.push({ account, quota: null, error: 'needs login', needsLogin: true });
      continue;
    }
    results.push(await refreshAccountQuota(store, account, options));
  }
  return results;
}

export function quotaScore(account: Account): number {
  const quota = account.quota;
  if (!quota) return -1;
  const daily = quota.dailyRemainingPct;
  const weekly = quota.weeklyRemainingPct;
  if (daily === null && weekly === null) return -1;
  if (daily === null) return weekly ?? -1;
  if (weekly === null) return daily;
  return Math.min(daily, weekly);
}

function findPercent(output: string, labels: string[]): number | null {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) continue;
    const remaining =
      line.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:remaining|left|available)/i) ??
      line.match(/(?:remaining|left|available)[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
    if (remaining?.[1]) return clampPercent(Number(remaining[1]));

    const usedOfTotal = line.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:\/|of)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (usedOfTotal?.[1] && usedOfTotal[2]) {
      const used = Number(usedOfTotal[1]);
      const total = Number(usedOfTotal[2]);
      if (Number.isFinite(used) && Number.isFinite(total) && total > 0) {
        return clampPercent(((total - used) / total) * 100);
      }
    }
  }
  return null;
}

function findCreditPair(output: string, labels: string[]): { used: number; available: number } | null {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) continue;
    const match = line.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:\/|of)\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (!match?.[1] || !match[2]) continue;
    const used = Number(match[1]);
    const total = Number(match[2]);
    if (Number.isFinite(used) && Number.isFinite(total)) {
      return { used, available: Math.max(0, total - used) };
    }
  }
  return null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}
