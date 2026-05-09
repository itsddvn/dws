import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runDevinPtyForAccount } from '../../src/core/pty-runner';
import type { PtyModule, PtyProcess } from '../../src/core/pty-loader';
import type { Account, AccountStore } from '../../src/core/store';
import { createSandbox } from '../helpers/sandbox';

class FakePtyProcess implements PtyProcess {
  private readonly events = new EventEmitter();
  writes: string[] = [];

  onData(listener: (data: string) => void): { dispose(): void } {
    this.events.on('data', listener);
    return { dispose: () => this.events.off('data', listener) };
  }

  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void } {
    this.events.on('exit', listener);
    return { dispose: () => this.events.off('exit', listener) };
  }

  write(data: string): void {
    this.writes.push(data);
  }

  resize(): void {
    // No-op for tests.
  }

  kill(): void {
    this.emitExit(130);
  }

  emitData(data: string): void {
    this.events.emit('data', data);
  }

  emitExit(exitCode: number): void {
    this.events.emit('exit', { exitCode });
  }
}

describe('runDevinPtyForAccount', () => {
  it('ignores the old PTY exit during rotate and resolves on the replacement PTY', async () => {
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const accounts = [makeAccount('one'), makeAccount('two')];
      const touched: string[] = [];
      const store = {
        touchLastUsed: (id: string) => {
          touched.push(id);
          return accounts.find((account) => account.id === id)!;
        }
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const spawnedArgs: string[][] = [];
      const ptyModule: PtyModule = {
        spawn: (_file, args) => {
          const term = new FakePtyProcess();
          terms.push(term);
          spawnedArgs.push(args);
          return term;
        }
      };
      const rotateEngine = {
        rotate: async () => ({ account: accounts[1]! })
      };

      let resolved = false;
      const run = runDevinPtyForAccount(store, accounts[0]!, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        autoRotate: false,
        ptyModule,
        rotateEngine
      }).then((code) => {
        resolved = true;
        return code;
      });

      terms[0]!.emitData('Session ID: session-1\r\n');
      process.stdin.emit('data', Buffer.from(':rotate\r'));
      await waitFor(() => terms.length === 2);

      expect(resolved).toBe(false);
      expect(touched).toEqual(['one', 'two']);
      expect(spawnedArgs[1]).toEqual(['-r', 'session-1']);
      expect(terms[0]!.writes).not.toContain('\u0003');
      expect(terms[1]!.writes).toEqual([]);

      terms[1]!.emitExit(0);
      await expect(run).resolves.toBe(0);
      expect(resolved).toBe(true);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      sandbox.cleanup();
    }
  });

  it('auto-rotates recoverable errors by resuming the session with the last prompt as initial input', async () => {
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const accounts = [makeAccount('one'), makeAccount('two')];
      const store = {
        touchLastUsed: () => accounts[0]!
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const spawnedArgs: string[][] = [];
      const ptyModule: PtyModule = {
        spawn: (_file, args) => {
          const term = new FakePtyProcess();
          terms.push(term);
          spawnedArgs.push(args);
          return term;
        }
      };
      const rotateEngine = {
        rotate: async () => ({ account: accounts[1]! })
      };

      const run = runDevinPtyForAccount(store, accounts[0]!, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        autoRotate: true,
        ptyModule,
        rotateEngine
      });

      terms[0]!.emitData('Session ID: session-1\r\n');
      process.stdin.emit('data', Buffer.from('retry this\r'));
      process.stdin.emit('data', Buffer.from('\u001b[24;1R'));
      terms[0]!.emitData('Something went wrong\n');
      terms[0]!.emitData('  An internal error occurred. Send a message to retry');
      await waitFor(() => terms.length === 2);

      expect(spawnedArgs[1]).toEqual(['-r', 'session-1', '--', 'retry this']);
      expect(terms[1]!.writes).toEqual([]);

      terms[1]!.emitExit(0);
      await expect(run).resolves.toBe(0);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      sandbox.cleanup();
    }
  });

  it('waits and runs devin --continue for a rate limit before switching accounts', async () => {
    vi.useFakeTimers();
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const accounts = [makeAccount('one'), makeAccount('two')];
      const store = {
        touchLastUsed: () => accounts[0]!
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const spawnedArgs: string[][] = [];
      const ptyModule: PtyModule = {
        spawn: (_file, args) => {
          const term = new FakePtyProcess();
          terms.push(term);
          spawnedArgs.push(args);
          return term;
        }
      };
      const rotateEngine = {
        rotate: vi.fn(async () => ({ account: accounts[1]! }))
      };

      const run = runDevinPtyForAccount(store, accounts[0]!, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        autoRotate: true,
        rateLimitRetryDelayMs: 60_000,
        ptyModule,
        rotateEngine
      });

      terms[0]!.emitData('Session ID: session-1\r\n');
      terms[0]!.emitData('Permission denied: Rate limit exceeded. Please try again in about an hour.');
      await vi.advanceTimersByTimeAsync(59_999);

      expect(terms).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(1);
      await flushAsync();

      expect(terms).toHaveLength(2);
      expect(spawnedArgs[1]).toEqual(['--continue']);
      expect(rotateEngine.rotate).not.toHaveBeenCalled();

      terms[1]!.emitExit(0);
      await expect(run).resolves.toBe(0);
    } finally {
      vi.useRealTimers();
      stdout.mockRestore();
      stderr.mockRestore();
      sandbox.cleanup();
    }
  });

  it('does not start rate-limit recovery when Devin asks a question mentioning rate limits', async () => {
    vi.useFakeTimers();
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const account = makeAccount('one');
      const store = {
        touchLastUsed: () => account
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const spawnedArgs: string[][] = [];
      const ptyModule: PtyModule = {
        spawn: (_file, args) => {
          const term = new FakePtyProcess();
          terms.push(term);
          spawnedArgs.push(args);
          return term;
        }
      };
      const rotateEngine = {
        rotate: vi.fn(async () => ({ account: null }))
      };

      const run = runDevinPtyForAccount(store, account, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        autoRotate: true,
        rateLimitRetryDelayMs: 60_000,
        ptyModule,
        rotateEngine
      });

      terms[0]!.emitData('How should we handle rate limit retry behavior in this plan?');
      await vi.advanceTimersByTimeAsync(60_000);
      await flushAsync();

      expect(terms).toHaveLength(1);
      expect(spawnedArgs).toEqual([[]]);
      expect(rotateEngine.rotate).not.toHaveBeenCalled();

      terms[0]!.emitExit(0);
      await expect(run).resolves.toBe(0);
    } finally {
      vi.useRealTimers();
      stdout.mockRestore();
      stderr.mockRestore();
      sandbox.cleanup();
    }
  });

  it('switches by quota after three failed devin --continue rate-limit retries', async () => {
    vi.useFakeTimers();
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const accounts = [makeAccount('one'), makeAccount('two')];
      const store = {
        touchLastUsed: () => accounts[0]!
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const spawnedArgs: string[][] = [];
      const ptyModule: PtyModule = {
        spawn: (_file, args) => {
          const term = new FakePtyProcess();
          terms.push(term);
          spawnedArgs.push(args);
          return term;
        }
      };
      const rotateEngine = {
        rotate: vi.fn(async () => ({ account: accounts[1]! }))
      };

      const run = runDevinPtyForAccount(store, accounts[0]!, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv: sandbox.env,
        autoRotate: true,
        rateLimitRetryDelayMs: 60_000,
        ptyModule,
        rotateEngine
      });

      terms[0]!.emitData('Session ID: session-1\r\n');
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        terms[attempt - 1]!.emitData('Permission denied: Rate limit exceeded. Please try again in about an hour.');
        await vi.advanceTimersByTimeAsync(60_000);
        await flushAsync();
        expect(terms).toHaveLength(attempt + 1);
        expect(spawnedArgs[attempt]).toEqual(['--continue']);
      }

      terms[3]!.emitData('Permission denied: Rate limit exceeded. Please try again in about an hour.');
      await flushAsync();

      expect(terms).toHaveLength(5);
      expect(rotateEngine.rotate).toHaveBeenCalledWith({ current: accounts[0], manual: true, sessionId: 'session-1' });
      expect(spawnedArgs[4]).toEqual(['-r', 'session-1']);

      terms[4]!.emitExit(0);
      await expect(run).resolves.toBe(0);
    } finally {
      vi.useRealTimers();
      stdout.mockRestore();
      stderr.mockRestore();
      sandbox.cleanup();
    }
  });

  it('writes stdin debug logs under the app data directory with private permissions', async () => {
    const sandbox = createSandbox();
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const originalCwd = process.cwd();
    process.chdir(sandbox.root);
    const cwdDebugPath = path.join(process.cwd(), 'dsw-stdin-debug.log');
    try {
      const account = makeAccount('one');
      const store = {
        touchLastUsed: () => account
      } as unknown as AccountStore;
      const terms: FakePtyProcess[] = [];
      const ptyModule: PtyModule = {
        spawn: () => {
          const term = new FakePtyProcess();
          terms.push(term);
          return term;
        }
      };
      const baseEnv = { ...sandbox.env, DSW_DEBUG_STDIN: '1' };
      const debugPath = path.join(sandbox.paths.appDataDir, 'stdin-debug.log');
      fs.writeFileSync(debugPath, '', { mode: 0o644 });

      const run = runDevinPtyForAccount(store, account, {
        args: [],
        appPaths: sandbox.paths,
        baseEnv,
        autoRotate: false,
        ptyModule
      });

      process.stdin.emit('data', Buffer.from('sample-input'));

      expect(fs.existsSync(debugPath)).toBe(true);
      expect(fs.existsSync(cwdDebugPath)).toBe(false);
      expect(fs.statSync(debugPath).mode & 0o777).toBe(0o600);

      terms[0]!.emitExit(0);
      await expect(run).resolves.toBe(0);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
      process.chdir(originalCwd);
      sandbox.cleanup();
    }
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

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for predicate');
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
