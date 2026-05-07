import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheTtlMs,
  invalidateQuotaCacheEntry,
  isCacheBypassed,
  mergeAccountQuotaWithCache,
  readQuotaCache,
  writeQuotaCache
} from '../../src/core/quota-cache';
import type { AccountQuota } from '../../src/core/quota';
import type { Account } from '../../src/core/store';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

function makeAccount(name: string, lastUsedAt: number | null = null): Account {
  return {
    id: `id-${name}`,
    name,
    email: null,
    tier: null,
    plan: null,
    orgId: null,
    createdAt: 0,
    lastUsedAt,
    needsLogin: false
  };
}

function makeQuota(account: Account, remainingPercent: string): AccountQuota {
  return {
    account,
    status: 'ok',
    summary: { remainingPercent, tier: 'pro' },
    rawRedacted: '',
    exitCode: 0
  };
}

describe('quota cache', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it('persists fetched quota entries and reads them back', () => {
    const cache = readQuotaCache(sandbox.paths);
    const a = makeAccount('a');
    const b = makeAccount('b');
    writeQuotaCache(cache, [makeQuota(a, '50%'), makeQuota(b, '90%')], 1_000);

    const reread = readQuotaCache(sandbox.paths);
    expect(reread.get('id-a')?.summary.remainingPercent).toBe('50%');
    expect(reread.get('id-b')?.summary.remainingPercent).toBe('90%');
  });

  it('treats fresh cache entries as fresh and stale ones as stale', () => {
    const cache = readQuotaCache(sandbox.paths);
    const a = makeAccount('a');
    const b = makeAccount('b');
    writeQuotaCache(cache, [makeQuota(a, '50%')], 1_000);

    const reread = readQuotaCache(sandbox.paths);
    const merged = mergeAccountQuotaWithCache([a, b], reread, { DSW_QUOTA_CACHE_TTL_MS: '5000' }, 4_000);
    expect(merged.fresh.map((q) => q.account.name)).toEqual(['a']);
    expect(merged.stale.map((s) => s.name)).toEqual(['b']);
  });

  it('expires entries older than the TTL', () => {
    const cache = readQuotaCache(sandbox.paths);
    const a = makeAccount('a');
    writeQuotaCache(cache, [makeQuota(a, '10%')], 0);

    const reread = readQuotaCache(sandbox.paths);
    const merged = mergeAccountQuotaWithCache([a], reread, { DSW_QUOTA_CACHE_TTL_MS: '500' }, 1_000);
    expect(merged.fresh).toEqual([]);
    expect(merged.stale.map((s) => s.name)).toEqual(['a']);
  });

  it('returns the default TTL when DSW_QUOTA_CACHE_TTL_MS is unset or invalid', () => {
    expect(cacheTtlMs({})).toBe(5 * 60 * 1000);
    expect(cacheTtlMs({ DSW_QUOTA_CACHE_TTL_MS: '' })).toBe(5 * 60 * 1000);
    expect(cacheTtlMs({ DSW_QUOTA_CACHE_TTL_MS: 'nope' })).toBe(5 * 60 * 1000);
    expect(cacheTtlMs({ DSW_QUOTA_CACHE_TTL_MS: '-1' })).toBe(5 * 60 * 1000);
    expect(cacheTtlMs({ DSW_QUOTA_CACHE_TTL_MS: '0' })).toBe(0);
    expect(cacheTtlMs({ DSW_QUOTA_CACHE_TTL_MS: '1500' })).toBe(1500);
  });

  it('treats DSW_SKIP_QUOTA=1 as a bypass signal', () => {
    expect(isCacheBypassed({})).toBe(false);
    expect(isCacheBypassed({ DSW_SKIP_QUOTA: '0' })).toBe(false);
    expect(isCacheBypassed({ DSW_SKIP_QUOTA: '1' })).toBe(true);
  });

  it('ignores a corrupt cache file without throwing', () => {
    fs.writeFileSync(`${sandbox.paths.appDataDir}/quota-cache.json`, 'not json');
    const cache = readQuotaCache(sandbox.paths);
    const a = makeAccount('a');
    const merged = mergeAccountQuotaWithCache([a], cache, {}, 0);
    expect(merged.fresh).toEqual([]);
    expect(merged.stale.map((s) => s.name)).toEqual(['a']);
  });

  it('invalidateQuotaCacheEntry removes a single entry', () => {
    const cache = readQuotaCache(sandbox.paths);
    const a = makeAccount('a');
    const b = makeAccount('b');
    writeQuotaCache(cache, [makeQuota(a, '50%'), makeQuota(b, '90%')], 1_000);

    invalidateQuotaCacheEntry('id-a', sandbox.paths);

    const reread = readQuotaCache(sandbox.paths);
    expect(reread.get('id-a')).toBeUndefined();
    expect(reread.get('id-b')?.summary.remainingPercent).toBe('90%');
  });

  it('invalidateQuotaCacheEntry is a no-op when the entry is missing', () => {
    expect(() => invalidateQuotaCacheEntry('does-not-exist', sandbox.paths)).not.toThrow();
  });
});
