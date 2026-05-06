import { describe, expect, it } from 'vitest';
import { pickNextAccount } from '../../src/core/runner';
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
