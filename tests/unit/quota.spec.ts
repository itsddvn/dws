import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseQuotaSummary, readQuotaForAccount } from '../../src/core/quota';
import type { Account } from '../../src/core/store';
import type { RunResult } from '../../src/util/exec';
import { createSandbox } from '../helpers/sandbox';

function makeAccount(): Account {
  return {
    id: 'account-id',
    name: 'account',
    email: null,
    tier: null,
    plan: null,
    orgId: null,
    createdAt: 0,
    lastUsedAt: null,
    needsLogin: false
  };
}

function makeRunResult(stdout: string): RunResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false
  };
}

describe('parseQuotaSummary', () => {
  it('parses real Devin /usage output', () => {
    const summary = parseQuotaSummary(`
Trial · 100% remaining (resets in 5h 41m)

Fetching quota...

Quota used: 0% (remaining: 100%)
Quota resets May 7, 3:00 PM (UTC+7).
`);

    expect(summary).toEqual({
      tier: 'Trial',
      usedPercent: '0%',
      remainingPercent: '100%',
      resetsIn: '5h 41m',
      resetAt: 'May 7, 3:00 PM (UTC+7)'
    });
  });

  it('falls back to headline remaining percent when detailed line is absent', () => {
    const summary = parseQuotaSummary('Pro - 75% remaining (resets in 1d 2h)');

    expect(summary).toMatchObject({
      tier: 'Pro',
      remainingPercent: '75%',
      resetsIn: '1d 2h'
    });
  });

  it('parses quota exhausted output as zero remaining', () => {
    const summary = parseQuotaSummary(
      'Error: Agent error: Your daily usage quota has been exhausted. Visit https://app.devin.ai/plans to manage your plan.'
    );

    expect(summary.usedPercent).toBe('100%');
    expect(summary.remainingPercent).toBe('0%');
  });
});

describe('readQuotaForAccount', () => {
  it('classifies parsed 0% remaining output as exhausted', async () => {
    const quota = await readQuotaForAccount(makeAccount(), {
      runImpl: async () =>
        makeRunResult(`
Trial · 0% remaining (resets in 4h 36m)

Quota used: 100% (remaining: 0%)
Quota resets May 7, 3:00 PM (UTC+7).
`)
    });

    expect(quota.status).toBe('exhausted');
    expect(quota.summary.remainingPercent).toBe('0%');
  });

  it('uses --print fallback when a test run implementation is injected', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const quota = await readQuotaForAccount(makeAccount(), {
      startupDelayMs: 0,
      timeoutMs: 1,
      runImpl: async (command, args) => {
        calls.push({ command, args });
        if (command === 'devin' && args[0] === '--print') {
          return makeRunResult(`
Trial · 88% remaining (resets in 4h 20m)

Quota used: 12% (remaining: 88%)
Quota resets May 7, 3:00 PM (UTC+7).
`);
        }
        throw new Error(`unexpected call: ${command} ${args.join(' ')}`);
      }
    });

    expect(quota.status).toBe('ok');
    expect(quota.summary.remainingPercent).toBe('88%');
    expect(calls).toEqual([{ command: 'devin', args: ['--print', '/usage'] }]);
  });

  it('falls back to --print when auto transport cannot start node-pty', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const quota = await readQuotaForAccount(makeAccount(), {
      ptyProbeImpl: async () => ({
        raw: 'PTY unavailable: node-pty spawn failed: posix_spawnp failed.',
        timedOut: false,
        exitCode: null
      }),
      runImpl: async (command, args) => {
        calls.push({ command, args });
        return makeRunResult(`
Trial · 74% remaining (resets in 18h 13m)

Quota used: 26% (remaining: 74%)
Quota resets May 8, 3:00 PM (UTC+7).
`);
      }
    });

    expect(quota.status).toBe('ok');
    expect(quota.summary.remainingPercent).toBe('74%');
    expect(quota.rawRedacted).not.toContain('PTY unavailable');
    expect(calls).toEqual([{ command: 'devin', args: ['--print', '/usage'] }]);
  });

  it('does not use print fallback when pty transport is explicitly required', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const quota = await readQuotaForAccount(makeAccount(), {
      transport: 'pty',
      ptyProbeImpl: async () => ({
        raw: 'PTY unavailable: node-pty spawn failed: posix_spawnp failed.',
        timedOut: false,
        exitCode: null
      }),
      runImpl: async (command, args) => {
        calls.push({ command, args });
        return makeRunResult('Trial · 74% remaining');
      }
    });

    expect(quota.status).toBe('error');
    expect(quota.rawRedacted).toContain('PTY unavailable');
    expect(calls).toEqual([]);
  });

  it('can skip profile runtime preparation for rotate-confirm validation', async () => {
    const sandbox = createSandbox();
    try {
      const sharedConfig = path.join(sandbox.configHome, 'devin', 'config.json');
      fs.mkdirSync(path.dirname(sharedConfig), { recursive: true });
      fs.writeFileSync(sharedConfig, JSON.stringify({ theme: 'dark' }));

      const quota = await readQuotaForAccount(makeAccount(), {
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        prepareRuntime: false,
        runImpl: async () => makeRunResult('Trial · 100% remaining')
      });

      const profileConfig = path.join(sandbox.paths.profilesDir, 'account-id', 'config', 'devin', 'config.json');
      expect(quota.status).toBe('ok');
      expect(quota.summary.remainingPercent).toBe('100%');
      expect(fs.existsSync(profileConfig)).toBe(false);
    } finally {
      sandbox.cleanup();
    }
  });
});
