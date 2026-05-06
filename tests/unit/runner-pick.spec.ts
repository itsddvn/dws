import { describe, expect, it } from 'vitest';
import { pickAccountByQuota } from '../../src/core/runner';
import type { Account } from '../../src/core/store';

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: overrides.id ?? `id-${overrides.name ?? 'x'}`,
    name: overrides.name ?? 'x',
    email: null,
    tier: null,
    plan: null,
    createdAt: 0,
    lastUsedAt: null,
    needsLogin: false,
    quota: null,
    ...overrides
  };
}

function makeQuota(daily: number | null, weekly: number | null = null) {
  return {
    fetchedAt: 0,
    dailyRemainingPct: daily,
    weeklyRemainingPct: weekly,
    usedPromptCredits: null,
    availablePromptCredits: null,
    usedFlowCredits: null,
    availableFlowCredits: null,
    usedFlexCredits: null,
    availableFlexCredits: null,
    rawOutput: ''
  };
}

describe('pickAccountByQuota', () => {
  it('picks the account with the highest min(daily, weekly) remaining', () => {
    const accounts = [
      makeAccount({ name: 'a', quota: makeQuota(20, 90) }),
      makeAccount({ name: 'b', quota: makeQuota(80, 60) }),
      makeAccount({ name: 'c', quota: makeQuota(40, 40) })
    ];
    expect(pickAccountByQuota(accounts)?.name).toBe('b');
  });

  it('skips accounts that need login', () => {
    const accounts = [
      makeAccount({ name: 'a', needsLogin: true, quota: makeQuota(99) }),
      makeAccount({ name: 'b', quota: makeQuota(50, 50) })
    ];
    expect(pickAccountByQuota(accounts)?.name).toBe('b');
  });

  it('rotates between accounts that share the same quota score by least recently used', () => {
    const accounts = [
      makeAccount({ name: 'a', lastUsedAt: 1000, quota: makeQuota(70, 70) }),
      makeAccount({ name: 'b', lastUsedAt: 500, quota: makeQuota(70, 70) }),
      makeAccount({ name: 'c', lastUsedAt: null, quota: makeQuota(70, 70) })
    ];
    expect(pickAccountByQuota(accounts)?.name).toBe('c');
  });

  it('falls back to accounts without quota data when nothing else is eligible', () => {
    const accounts = [makeAccount({ name: 'a' }), makeAccount({ name: 'b' })];
    expect(pickAccountByQuota(accounts)?.name).toBe('a');
  });

  it('returns null when no accounts are eligible', () => {
    const accounts = [makeAccount({ name: 'a', needsLogin: true })];
    expect(pickAccountByQuota(accounts)).toBeNull();
  });
});
