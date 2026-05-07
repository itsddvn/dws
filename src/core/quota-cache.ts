import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { atomicWriteJsonSync, readJsonOrNull } from '../util/atomic-write';
import type { AccountQuota, QuotaSummary } from './quota';
import type { Account } from './store';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const CACHE_FILE = 'quota-cache.json';

export interface CachedQuota {
  fetchedAtMs: number;
  status: AccountQuota['status'];
  summary: QuotaSummary;
  exitCode: number | null;
}

interface CacheFile {
  version: 1;
  entries: Record<string, CachedQuota>;
}

export class QuotaCache {
  private dirty = false;

  constructor(private readonly entries: Map<string, CachedQuota>, private readonly filePath: string) {}

  get(accountId: string): CachedQuota | undefined {
    return this.entries.get(accountId);
  }

  set(accountId: string, value: CachedQuota): void {
    this.entries.set(accountId, value);
    this.dirty = true;
  }

  delete(accountId: string): boolean {
    if (!this.entries.delete(accountId)) return false;
    this.dirty = true;
    return true;
  }

  hasFresh(accountId: string, ttlMs: number, nowMs: number = Date.now()): boolean {
    const entry = this.entries.get(accountId);
    if (!entry) return false;
    return nowMs - entry.fetchedAtMs < ttlMs;
  }

  flush(): void {
    if (!this.dirty) return;
    const payload: CacheFile = { version: 1, entries: Object.fromEntries(this.entries) };
    atomicWriteJsonSync(this.filePath, payload);
    this.dirty = false;
  }
}

/**
 * Drop the cached quota entry for a single account. Used after a devin
 * run so the next quota-aware pick re-checks that account instead of
 * trusting a now-stale "remaining" percentage.
 */
export function invalidateQuotaCacheEntry(accountId: string, appPaths: AppPaths = resolveAppPaths()): void {
  const cache = readQuotaCache(appPaths);
  if (cache.delete(accountId)) cache.flush();
}

export function readQuotaCache(appPaths: AppPaths = resolveAppPaths()): QuotaCache {
  const filePath = quotaCachePath(appPaths);
  const parsed = readJsonOrNull<Partial<CacheFile>>(filePath);
  const entries = new Map<string, CachedQuota>();
  if (parsed && parsed.version === 1 && parsed.entries) {
    for (const [id, value] of Object.entries(parsed.entries)) {
      if (isCachedQuota(value)) entries.set(id, value);
    }
  }
  return new QuotaCache(entries, filePath);
}

export function writeQuotaCache(cache: QuotaCache, refreshed: AccountQuota[], nowMs: number = Date.now()): void {
  for (const quota of refreshed) {
    cache.set(quota.account.id, {
      fetchedAtMs: nowMs,
      status: quota.status,
      summary: quota.summary,
      exitCode: quota.exitCode
    });
  }
  cache.flush();
}

export interface MergedQuotaState {
  fresh: AccountQuota[];
  stale: Account[];
}

/**
 * Split the given accounts into ones whose cached quota is still valid
 * (`fresh`) and ones that need to be re-checked (`stale`). Returns the
 * fresh entries inflated back into the `AccountQuota` shape that
 * `pickBestAccountByQuota` expects.
 */
export function mergeAccountQuotaWithCache(
  accounts: Account[],
  cache: QuotaCache,
  env: NodeJS.ProcessEnv,
  nowMs: number = Date.now()
): MergedQuotaState {
  const ttl = cacheTtlMs(env);
  const fresh: AccountQuota[] = [];
  const stale: Account[] = [];
  for (const account of accounts) {
    if (cache.hasFresh(account.id, ttl, nowMs)) {
      const entry = cache.get(account.id)!;
      fresh.push({ account, status: entry.status, summary: entry.summary, rawRedacted: '', exitCode: entry.exitCode });
    } else {
      stale.push(account);
    }
  }
  return { fresh, stale };
}

export function cacheTtlMs(env: NodeJS.ProcessEnv): number {
  const raw = env.DSW_QUOTA_CACHE_TTL_MS;
  if (!raw) return DEFAULT_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TTL_MS;
}

export function isCacheBypassed(env: NodeJS.ProcessEnv): boolean {
  return env.DSW_SKIP_QUOTA === '1';
}

function quotaCachePath(appPaths: AppPaths): string {
  return path.join(appPaths.appDataDir, CACHE_FILE);
}

function isCachedQuota(value: unknown): value is CachedQuota {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CachedQuota>;
  return (
    typeof candidate.fetchedAtMs === 'number' &&
    typeof candidate.status === 'string' &&
    typeof candidate.summary === 'object' &&
    candidate.summary !== null
  );
}
