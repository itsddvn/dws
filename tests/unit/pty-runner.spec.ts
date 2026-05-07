import { EventEmitter } from 'node:events';
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
      const ptyModule: PtyModule = {
        spawn: () => {
          const term = new FakePtyProcess();
          terms.push(term);
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
