import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runUse } from '../../src/cli/commands/use';
import type { RunDevinOptions } from '../../src/core/runner';
import type { Account } from '../../src/core/store';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

const mocks = vi.hoisted(() => ({
  runDevinForAccount: vi.fn()
}));

vi.mock('../../src/core/runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/runner')>();
  return {
    ...actual,
    runDevinForAccount: mocks.runDevinForAccount
  };
});

describe('runUse', () => {
  let sandbox: Sandbox;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    sandbox = createSandbox();
    originalEnv = { ...process.env };
    process.env.DSW_DATA_HOME = sandbox.dataHome;
    process.env.DSW_CONFIG_HOME = sandbox.configHome;
    process.exitCode = undefined;
    mocks.runDevinForAccount.mockResolvedValue(0);
  });

  afterEach(() => {
    process.env = originalEnv;
    sandbox.cleanup();
    vi.clearAllMocks();
  });

  it('runs pinned accounts without automatic rotation', async () => {
    const account = makeAccount('work');
    fs.writeFileSync(sandbox.paths.storePath, JSON.stringify({ version: 1, accounts: [account] }));

    await runUse({ name: 'work', args: ['-p', 'hello'] });

    expect(mocks.runDevinForAccount).toHaveBeenCalledWith(expect.any(Object), account, {
      args: ['-p', 'hello'],
      autoRotate: false
    } satisfies RunDevinOptions);
  });
});

function makeAccount(name: string): Account {
  return {
    id: name,
    name,
    email: null,
    tier: null,
    plan: null,
    orgId: null,
    createdAt: 0,
    lastUsedAt: null,
    needsLogin: false
  };
}
