import { describe, expect, it } from 'vitest';
import { isKnownFreeAccount, isTrialAccount, normalizeKnownTierLabel } from '../../src/core/account-eligibility';
import type { AccountQuota } from '../../src/core/quota';
import type { Account } from '../../src/core/store';

describe('account eligibility labels', () => {
  it('normalizes Free labels from account metadata and Devin quota banners', () => {
    expect(normalizeKnownTierLabel('FreePlan')).toBe('Free');
    expect(normalizeKnownTierLabel('Free plan, use /upgrade to access better models')).toBe('Free');
    expect(normalizeKnownTierLabel('free-plan')).toBe('Free');
  });

  it('normalizes Trial labels from account metadata and Devin quota banners', () => {
    expect(normalizeKnownTierLabel('Trial')).toBe('Trial');
    expect(normalizeKnownTierLabel('Trial plan')).toBe('Trial');
  });

  it('identifies known Free accounts and Trial quota rows with one shared rule', () => {
    const account = makeAccount({ tier: 'FreePlan' });
    const trialQuota = makeQuota(account, 'Trial');

    expect(isKnownFreeAccount(account)).toBe(true);
    expect(isTrialAccount(account, trialQuota)).toBe(true);
  });
});

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: 'account-id',
    name: 'account',
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

function makeQuota(account: Account, tier: string): AccountQuota {
  return {
    account,
    status: 'ok',
    summary: { tier, remainingPercent: '100%' },
    rawRedacted: '',
    exitCode: 0
  };
}
