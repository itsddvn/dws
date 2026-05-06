import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../../src/core/store';
import { runCapture } from '../../src/util/exec';
import { createSandbox, fakeDevinPath, type Sandbox } from '../helpers/sandbox';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI_ENTRY = path.join(REPO_ROOT, 'src', 'cli', 'index.ts');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

let shimDir: string;

beforeAll(() => {
  // Build a tiny shell shim named "devin" so child processes that spawn
  // "devin" reach our fake-devin script via PATH.
  shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-shim-'));
  const shimPath = path.join(shimDir, 'devin');
  fs.writeFileSync(
    shimPath,
    `#!/bin/bash\nexec "${TSX_BIN}" "${fakeDevinPath()}" "$@"\n`,
    { mode: 0o755 }
  );
});

afterAll(() => {
  if (shimDir) fs.rmSync(shimDir, { recursive: true, force: true });
});

function baseQuota({ daily, weekly }: { daily: number; weekly: number }) {
  return {
    fetchedAt: Math.floor(Date.now() / 1000),
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

async function runCli(sandbox: Sandbox, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<RunResult> {
  const result = await runCapture(TSX_BIN, [CLI_ENTRY, ...args], {
    env: {
      ...sandbox.env,
      PATH: `${shimDir}:${process.env.PATH ?? ''}`,
      ...extraEnv
    },
    timeoutMs: 30_000
  });
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode ?? 0 };
}

describe('dsw CLI', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it('prints help with all PRD commands', async () => {
    const result = await runCli(sandbox, ['--help']);
    expect(result.exitCode).toBe(0);
    for (const command of ['list', 'quota', 'add', 'remove', 'login', 'doctor']) {
      expect(result.stdout).toContain(command);
    }
  });

  it('add -> list -> quota -> remove flow', async () => {
    const add = await runCli(sandbox, ['add', 'primary']);
    expect(add.exitCode, `add stdout=${add.stdout} stderr=${add.stderr}`).toBe(0);
    expect(add.stdout).toMatch(/Added primary/);

    const list = await runCli(sandbox, ['list']);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('primary');
    expect(list.stdout).toContain('ready');

    const quota = await runCli(sandbox, ['quota']);
    expect(quota.exitCode).toBe(0);
    expect(quota.stdout).toContain('primary');
    expect(quota.stdout).toMatch(/60%/);
    expect(quota.stdout).toMatch(/80%/);

    const remove = await runCli(sandbox, ['remove', 'primary', '--yes']);
    expect(remove.exitCode).toBe(0);
    const listAfter = await runCli(sandbox, ['list']);
    expect(listAfter.stdout).toContain('No Devin accounts');
  });

  it('refuses remove without --yes', async () => {
    await runCli(sandbox, ['add', 'tmp']);
    const result = await runCli(sandbox, ['remove', 'tmp']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--yes/);
  });

  it('default command picks the account with the most quota and forwards args to devin', async () => {
    await runCli(sandbox, ['add', 'low']);
    await runCli(sandbox, ['add', 'high']);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const accounts = store.list();
    const low = accounts.find((account) => account.name === 'low')!;
    const high = accounts.find((account) => account.name === 'high')!;
    store.setQuota(low.id, baseQuota({ daily: 10, weekly: 10 }));
    store.setQuota(high.id, baseQuota({ daily: 90, weekly: 90 }));

    const result = await runCli(sandbox, ['--no-refresh', 'some', 'forwarded', 'args']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/Selected high/);
    expect(result.stdout).toMatch(/some.*forwarded.*args/);
  });

  it('doctor reports paths and the devin binary version', async () => {
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('devin-switcher doctor');
    expect(result.stdout).toMatch(/devin: devin 0\.0\.0-fake/);
  });

  it('login marks an account as needs-login when devin auth login fails', async () => {
    await runCli(sandbox, ['add', 'x']);
    const result = await runCli(sandbox, ['login', 'x'], { DSW_FAKE_FAIL_LOGIN: '1' });
    expect(result.exitCode).toBe(1);
    const list = await runCli(sandbox, ['list']);
    expect(list.stdout).toMatch(/x\s+needs login/);
  });

  it('quota --raw prints the redacted /usage output', async () => {
    await runCli(sandbox, ['add', 'p']);
    const result = await runCli(sandbox, ['quota', 'p', '--raw']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/p \/usage output:/);
    expect(result.stdout).toMatch(/Daily quota: 60% remaining/);
  });
});
