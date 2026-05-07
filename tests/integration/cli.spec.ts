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

async function runCli(sandbox: Sandbox, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<RunResult> {
  const result = await runCapture(TSX_BIN, [CLI_ENTRY, ...args], {
    env: {
      ...sandbox.env,
      PATH: `${shimDir}:${process.env.PATH ?? ''}`,
      DSW_QUOTA_STARTUP_DELAY_MS: '100',
      DSW_QUOTA_TIMEOUT_MS: '3000',
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
    for (const command of ['list', 'add', 'remove', 'login', 'next', 'use', 'quota', 'update', 'doctor']) {
      expect(result.stdout).toContain(command);
    }
  });

  it('prints the package version', async () => {
    const result = await runCli(sandbox, ['--version']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('0.4.1');
  });

  it('add -> list -> remove flow', async () => {
    const add = await runCli(sandbox, ['add', 'primary']);
    expect(add.exitCode, `add stdout=${add.stdout} stderr=${add.stderr}`).toBe(0);
    expect(add.stdout).toMatch(/Added primary/);

    const list = await runCli(sandbox, ['list']);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('primary');
    expect(list.stdout).toContain('ready');

    const remove = await runCli(sandbox, ['remove', 'primary', '--yes']);
    expect(remove.exitCode).toBe(0);
    const listAfter = await runCli(sandbox, ['list']);
    expect(listAfter.stdout).toContain('No Devin accounts');
  });

  it('add without a name infers the account name after login', async () => {
    const add = await runCli(sandbox, ['add'], { DSW_FAKE_NAME: 'Jane Devin' });
    expect(add.exitCode, `add stdout=${add.stdout} stderr=${add.stderr}`).toBe(0);
    expect(add.stdout).toMatch(/Added jane-devin/);

    const list = await runCli(sandbox, ['list']);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain('jane-devin');
    expect(list.stdout).toContain('fake@example.com');
  });

  it('add without a name falls back to the email local part', async () => {
    const add = await runCli(sandbox, ['add'], { DSW_FAKE_EMAIL: 'person@example.com' });
    expect(add.exitCode, `add stdout=${add.stdout} stderr=${add.stderr}`).toBe(0);
    expect(add.stdout).toMatch(/Added person/);
  });

  it('refuses remove without --yes', async () => {
    await runCli(sandbox, ['add', 'tmp']);
    const result = await runCli(sandbox, ['remove', 'tmp']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--yes/);
  });

  it('default and next use max remaining quota, with least-recently-used as a tie breaker', async () => {
    await runCli(sandbox, ['add', 'one']);
    await runCli(sandbox, ['add', 'two']);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const accounts = store.list();
    const one = accounts.find((account) => account.name === 'one')!;
    const two = accounts.find((account) => account.name === 'two')!;
    store.update(one.id, (a) => ({ ...a, lastUsedAt: 100 }));
    store.update(two.id, (a) => ({ ...a, lastUsedAt: 50 }));

    const first = await runCli(sandbox, ['some', 'forwarded', 'args']);
    expect(first.exitCode).toBe(0);
    expect(first.stderr).toMatch(/Selected two/);
    expect(first.stdout).toMatch(/some.*forwarded.*args/);

    const second = await runCli(sandbox, ['next']);
    expect(second.exitCode).toBe(0);
    expect(second.stderr).toMatch(/Selected one/);
  });

  it('default command checks quota and picks the account with the most remaining quota', async () => {
    await runCli(sandbox, ['add', 'low']);
    await runCli(sandbox, ['add', 'high']);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const low = store.list().find((account) => account.name === 'low')!;
    const high = store.list().find((account) => account.name === 'high')!;
    store.update(low.id, (account) => ({ ...account, lastUsedAt: null }));
    store.update(high.id, (account) => ({ ...account, lastUsedAt: 5000 }));

    const result = await runCli(sandbox, ['-p', 'hello'], {
      DSW_FAKE_QUOTA_BY_PROFILE_JSON: JSON.stringify({
        [low.id]: { used: '95', remaining: '5' },
        [high.id]: { used: '20', remaining: '80' }
      })
    });

    expect(result.exitCode, `stdout=${result.stdout} stderr=${result.stderr}`).toBe(0);
    expect(result.stderr).toContain('Checking quota');
    expect(result.stderr).toMatch(/Selected high/);
    expect(result.stderr).toContain('quota remaining: 80%');
  });

  it('next checks quota and picks the account with the most remaining quota', async () => {
    await runCli(sandbox, ['add', 'one']);
    await runCli(sandbox, ['add', 'two']);
    await runCli(sandbox, ['add', 'three']);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const one = store.list().find((account) => account.name === 'one')!;
    const two = store.list().find((account) => account.name === 'two')!;
    const three = store.list().find((account) => account.name === 'three')!;
    store.update(one.id, (account) => ({ ...account, lastUsedAt: 10 }));
    store.update(two.id, (account) => ({ ...account, lastUsedAt: 30 }));
    store.update(three.id, (account) => ({ ...account, lastUsedAt: 20 }));

    const result = await runCli(sandbox, ['next', '-p', 'hello'], {
      DSW_FAKE_QUOTA_BY_PROFILE_JSON: JSON.stringify({
        [one.id]: { used: '30', remaining: '70' },
        [two.id]: { used: '0', remaining: '100' },
        [three.id]: { used: '100', remaining: '0' }
      })
    });

    expect(result.exitCode, `stdout=${result.stdout} stderr=${result.stderr}`).toBe(0);
    expect(result.stderr).toMatch(/Selected two/);
    expect(result.stderr).toContain('quota remaining: 100%');
  });

  it('next forwards devin options', async () => {
    await runCli(sandbox, ['add', 'one']);

    const result = await runCli(sandbox, ['next', '-p', 'hello']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/Selected one/);
    expect(result.stdout).toMatch(/-p.*hello/);
  });

  it('use runs a specific account and forwards devin options', async () => {
    await runCli(sandbox, ['add', 'one']);
    await runCli(sandbox, ['add', 'two']);

    const result = await runCli(sandbox, ['use', 'two', '-p', 'hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toMatch(/Selected two/);
    expect(result.stdout).toMatch(/-p.*hello/);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const two = store.list().find((account) => account.name === 'two')!;
    expect(two.lastUsedAt).toEqual(expect.any(Number));
  });

  it('quota checks every ready account and skips accounts needing login', async () => {
    await runCli(sandbox, ['add', 'one']);
    await runCli(sandbox, ['add', 'two']);

    const store = new AccountStore(sandbox.paths);
    store.reload();
    const two = store.list().find((account) => account.name === 'two')!;
    store.markNeedsLogin(two.id);

    const result = await runCli(sandbox, ['quota'], {
      DSW_QUOTA_STARTUP_DELAY_MS: '100',
      DSW_QUOTA_TIMEOUT_MS: '3000',
      DSW_FAKE_QUOTA_USED: '12',
      DSW_FAKE_QUOTA_REMAINING: '88',
      DSW_FAKE_QUOTA_RESETS_IN: '4h 20m',
      DSW_FAKE_QUOTA_RESET_AT: 'May 7, 3:00 PM (UTC+7)'
    });

    expect(result.exitCode, `quota stdout=${result.stdout} stderr=${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('one');
    expect(result.stdout).toContain('ok');
    expect(result.stdout).toContain('Trial');
    expect(result.stdout).toContain('12%');
    expect(result.stdout).toContain('88%');
    expect(result.stdout).toContain('4h 20m');
    expect(result.stdout).toContain('May 7, 3:00 PM (UTC+7)');
    expect(result.stdout).toMatch(/two\s+needs login/);
  });

  it('update --dry-run prints the local checkout update steps', async () => {
    const result = await runCli(sandbox, ['update', '--dry-run']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('git pull --ff-only');
    expect(result.stdout).toContain('npm install');
    expect(result.stdout).toContain('npm run build');
  });

  it('doctor reports paths and the devin binary version', async () => {
    const result = await runCli(sandbox, ['doctor']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('devin-switcher doctor');
    expect(result.stdout).toMatch(/devin: devin 0\.0\.0-fake/);
    expect(result.stdout).toMatch(/tmux: tmux /);
  });

  it('login marks an account as needs-login when devin auth login fails', async () => {
    await runCli(sandbox, ['add', 'x']);
    const result = await runCli(sandbox, ['login', 'x'], { DSW_FAKE_FAIL_LOGIN: '1' });
    expect(result.exitCode).toBe(1);
    const list = await runCli(sandbox, ['list']);
    expect(list.stdout).toMatch(/x\s+needs login/);
  });
});
