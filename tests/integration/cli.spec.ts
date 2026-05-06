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

  it('refuses remove without --yes', async () => {
    await runCli(sandbox, ['add', 'tmp']);
    const result = await runCli(sandbox, ['remove', 'tmp']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--yes/);
  });

  it('default command rotates between accounts (least-recently-used wins)', async () => {
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

  it('quota prints the per-account usage URL using the org id stored after add', async () => {
    await runCli(sandbox, ['add', 'p']);
    const store = new AccountStore(sandbox.paths);
    store.reload();
    const account = store.list().find((entry) => entry.name === 'p')!;
    // Simulate the org_id that `devin setup` would have written into the
    // per-profile config.json.
    const profileConfigDir = path.join(sandbox.paths.profilesDir, account.id, 'config', 'devin');
    fs.mkdirSync(profileConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(profileConfigDir, 'config.json'),
      JSON.stringify({ devin: { org_id: 'org-test-1' } })
    );

    const result = await runCli(sandbox, ['quota']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('org-test-1');
    expect(result.stdout).toContain('https://app.devin.ai/org/org-test-1/settings/usage');
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
});
