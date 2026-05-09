import { describe, expect, it, vi } from 'vitest';
import { RotateEngine } from '../../src/core/rotate-engine';
import { readQuotaForAccount } from '../../src/core/quota';
import type { AccountQuota } from '../../src/core/quota';
import type { Account, AccountStore } from '../../src/core/store';

vi.mock('../../src/core/quota', () => ({
  readQuotaForAccount: vi.fn()
}));

const readQuotaForAccountMock = vi.mocked(readQuotaForAccount);

describe('RotateEngine', () => {
  it('selects the alternate account with the highest positive quota', async () => {
    const current = makeAccount('current');
    const low = makeAccount('low', { lastUsedAt: 10, tier: 'Trial' });
    const high = makeAccount('high', { lastUsedAt: 20, tier: 'Trial' });
    const store = makeStore([current, low, high]);
    readQuotaForAccountMock.mockImplementation(async (account) => {
      if (account.id === 'low') return makeQuota(account, '15%');
      if (account.id === 'high') return makeQuota(account, '80%');
      return makeQuota(account, '0%', 'exhausted');
    });

    const result = await new RotateEngine(store, {}).rotate({ current, manual: true, sessionId: 'session-1' });

    expect(result).toEqual({ account: high });
  });

  it('ignores Free accounts when selecting a rotation target', async () => {
    const current = makeAccount('current');
    const free = makeAccount('free', { tier: 'FreePlan' });
    const trial = makeAccount('trial');
    const store = makeStore([current, free, trial]);
    readQuotaForAccountMock.mockImplementation(async (account) => {
      if (account.id === 'trial') return makeQuota(account, '40%', 'ok', 'Trial');
      return makeQuota(account, '0%', 'exhausted', 'Trial');
    });

    const result = await new RotateEngine(store, {}).rotate({ current, manual: true, sessionId: 'session-1' });

    expect(readQuotaForAccountMock).not.toHaveBeenCalledWith(free, expect.anything());
    expect(result).toEqual({ account: trial });
  });

  it('requires Trial tier even when a Free account has more remaining quota', async () => {
    const current = makeAccount('current');
    const free = makeAccount('free');
    const trial = makeAccount('trial');
    const store = makeStore([current, free, trial]);
    readQuotaForAccountMock.mockImplementation(async (account) => {
      if (account.id === 'free') return makeQuota(account, '99%', 'ok', 'Free');
      if (account.id === 'trial') return makeQuota(account, '20%', 'ok', 'Trial');
      return makeQuota(account, '0%', 'exhausted', 'Trial');
    });

    const result = await new RotateEngine(store, {}).rotate({ current, manual: true, sessionId: 'session-1' });

    expect(result).toEqual({ account: trial });
  });

  it('reports no usable account when every alternate account has zero or unknown quota', async () => {
    const current = makeAccount('current');
    const empty = makeAccount('empty', { tier: 'Trial' });
    const unknown = makeAccount('unknown', { tier: 'Trial' });
    const store = makeStore([current, empty, unknown]);
    readQuotaForAccountMock.mockImplementation(async (account) => {
      if (account.id === 'empty') return makeQuota(account, '0%', 'exhausted');
      return makeQuota(account, undefined, 'ok');
    });

    const result = await new RotateEngine(store, {}).rotate({ current, manual: true, sessionId: 'session-1' });

    expect(result).toEqual({ account: null, reason: 'không còn tài khoản nào còn đủ quota, vui lòng add thêm' });
  });
});

function makeStore(accounts: Account[]): AccountStore {
  return {
    list: () => accounts
  } as unknown as AccountStore;
}

function makeAccount(name: string, overrides: Partial<Account> = {}): Account {
  return {
    id: name,
    name,
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

function makeQuota(
  account: Account,
  remainingPercent: string | undefined,
  status: AccountQuota['status'] = 'ok',
  tier = account.tier ?? undefined
): AccountQuota {
  return {
    account,
    status,
    summary: {
      ...(tier ? { tier } : {}),
      ...(remainingPercent ? { remainingPercent } : {})
    },
    rawRedacted: '',
    exitCode: 0
  };
}
