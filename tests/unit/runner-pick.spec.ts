import { describe, expect, it } from 'vitest';
import {
  pickBestAccountByQuota,
  pickNextAccount
} from '../../src/core/runner';
import type { AccountQuota } from '../../src/core/quota';
import type { Account } from '../../src/core/store';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: overrides.id ?? `id-${overrides.name ?? 'x'}`,
    name: overrides.name ?? 'x',
    email: null,
    tier: null,
    plan: null,
    orgId: null,
    createdAt: 0,
    lastUsedAt: null,
    needsLogin: false,
    ...overrides
  };
}

function makeQuota(account: Account, overrides: Partial<AccountQuota>): AccountQuota {
  return {
    account,
    status: 'ok',
    summary: {},
    rawRedacted: '',
    exitCode: 0,
    ...overrides
  };
}

describe('pickNextAccount', () => {
  it('returns the least-recently-used eligible account', () => {
    const accounts = [
      makeAccount({ name: 'a', lastUsedAt: 1000 }),
      makeAccount({ name: 'b', lastUsedAt: 500 }),
      makeAccount({ name: 'c', lastUsedAt: 1500 })
    ];
    expect(pickNextAccount(accounts)?.name).toBe('b');
  });

  it('prefers accounts that have never been used', () => {
    const accounts = [
      makeAccount({ name: 'used', lastUsedAt: 1000 }),
      makeAccount({ name: 'fresh', lastUsedAt: null })
    ];
    expect(pickNextAccount(accounts)?.name).toBe('fresh');
  });

  it('skips accounts that need login', () => {
    const accounts = [
      makeAccount({ name: 'needs-login', needsLogin: true, lastUsedAt: null }),
      makeAccount({ name: 'ready', lastUsedAt: 5000 })
    ];
    expect(pickNextAccount(accounts)?.name).toBe('ready');
  });

  it('breaks ties by createdAt then name', () => {
    const accounts = [
      makeAccount({ name: 'b', createdAt: 200, lastUsedAt: null }),
      makeAccount({ name: 'a', createdAt: 100, lastUsedAt: null })
    ];
    expect(pickNextAccount(accounts)?.name).toBe('a');
  });

  it('returns null when no accounts are eligible', () => {
    const accounts = [makeAccount({ name: 'a', needsLogin: true })];
    expect(pickNextAccount(accounts)).toBeNull();
  });
});

describe('pickBestAccountByQuota', () => {
  it('prefers the account with the most remaining quota', () => {
    const low = makeAccount({ name: 'low', lastUsedAt: null });
    const high = makeAccount({ name: 'high', lastUsedAt: 5000 });

    expect(
      pickBestAccountByQuota(
        [low, high],
        [
          makeQuota(low, { summary: { tier: 'Trial', remainingPercent: '20%' } }),
          makeQuota(high, { summary: { tier: 'Trial', remainingPercent: '80%' } })
        ]
      )?.name
    ).toBe('high');
  });

  it('uses LRU as a tie breaker for equal quota', () => {
    const old = makeAccount({ name: 'old', lastUsedAt: 100 });
    const recent = makeAccount({ name: 'recent', lastUsedAt: 500 });

    expect(
      pickBestAccountByQuota(
        [recent, old],
        [
          makeQuota(recent, { summary: { tier: 'Trial', remainingPercent: '50%' } }),
          makeQuota(old, { summary: { tier: 'Trial', remainingPercent: '50%' } })
        ]
      )?.name
    ).toBe('old');
  });

  it('ignores Free quota rows even when they have the most remaining quota', () => {
    const free = makeAccount({ name: 'free', lastUsedAt: null });
    const trial = makeAccount({ name: 'trial', lastUsedAt: 5000 });

    expect(
      pickBestAccountByQuota(
        [free, trial],
        [
          makeQuota(free, { summary: { tier: 'Free', remainingPercent: '100%' } }),
          makeQuota(trial, { summary: { tier: 'Trial', remainingPercent: '20%' } })
        ]
      )?.name
    ).toBe('trial');
  });

  it('skips accounts already known as Free before considering fallback selection', () => {
    const free = makeAccount({ name: 'free', tier: 'FreePlan', lastUsedAt: null });
    const trial = makeAccount({ name: 'trial', tier: 'Trial', lastUsedAt: 5000 });

    expect(pickBestAccountByQuota([free, trial], [])?.name).toBe('trial');
  });

  it('skips exhausted and zero-remaining accounts when another account is usable', () => {
    const empty = makeAccount({ name: 'empty', lastUsedAt: null });
    const ready = makeAccount({ name: 'ready', lastUsedAt: 1000 });

    expect(
      pickBestAccountByQuota(
        [empty, ready],
        [
          makeQuota(empty, { status: 'exhausted', summary: { remainingPercent: '0%' } }),
          makeQuota(ready, { summary: { tier: 'Trial', remainingPercent: '10%' } })
        ]
      )?.name
    ).toBe('ready');
  });

  it('never falls back to an account with parsed 0% remaining', () => {
    const empty = makeAccount({ name: 'empty', lastUsedAt: null });
    const fallback = makeAccount({ name: 'fallback', lastUsedAt: 1000 });

    expect(
      pickBestAccountByQuota(
        [empty, fallback],
        [
          makeQuota(empty, { status: 'timeout', summary: { remainingPercent: '0%' }, exitCode: null }),
          makeQuota(fallback, { status: 'error', summary: { tier: 'Trial' }, exitCode: 1 })
        ]
      )?.name
    ).toBe('fallback');
  });

  it('falls back to LRU when quota checks fail', () => {
    const old = makeAccount({ name: 'old', lastUsedAt: 100 });
    const recent = makeAccount({ name: 'recent', lastUsedAt: 500 });

    expect(
      pickBestAccountByQuota(
        [recent, old],
        [
          makeQuota(recent, { status: 'error', summary: { tier: 'Trial' }, exitCode: 1 }),
          makeQuota(old, { status: 'timeout', summary: { tier: 'Trial' }, exitCode: null })
        ]
      )?.name
    ).toBe('old');
  });

  it('returns null when all ready accounts are exhausted', () => {
    const empty = makeAccount({ name: 'empty' });

    expect(pickBestAccountByQuota([empty], [makeQuota(empty, { status: 'exhausted', summary: { remainingPercent: '0%' } })])).toBeNull();
  });

  it('returns null when the only ready account has parsed 0% remaining', () => {
    const empty = makeAccount({ name: 'empty' });

    expect(pickBestAccountByQuota([empty], [makeQuota(empty, { status: 'ok', summary: { remainingPercent: '0%' } })])).toBeNull();
  });

  it('falls through to unknown candidates after positive but before fallback', () => {
    const positive = makeAccount({ name: 'positive', lastUsedAt: 100 });
    const unknown = makeAccount({ name: 'unknown', lastUsedAt: 50 });
    const fallback = makeAccount({ name: 'fallback', lastUsedAt: 10 });

    expect(
      pickBestAccountByQuota(
        [positive, unknown, fallback],
        [
          makeQuota(positive, { summary: { tier: 'Trial', remainingPercent: '40%' } }),
          makeQuota(unknown, { status: 'ok', summary: { tier: 'Trial' } }),
          makeQuota(fallback, { status: 'error', summary: { tier: 'Trial' }, exitCode: 1 })
        ]
      )?.name
    ).toBe('positive');

    // Drop the positive candidate; unknown should win over fallback.
    expect(
      pickBestAccountByQuota(
        [unknown, fallback],
        [
          makeQuota(unknown, { status: 'ok', summary: { tier: 'Trial' } }),
          makeQuota(fallback, { status: 'error', summary: { tier: 'Trial' }, exitCode: 1 })
        ]
      )?.name
    ).toBe('unknown');
  });
});
