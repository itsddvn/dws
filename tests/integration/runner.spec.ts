import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';
import { AccountService, type Account } from '../../src/core/accounts/service';
import { resolveProfilePaths } from '../../src/core/profiles/paths';
import { RedactedLineStream, runDevinWithAccount } from '../../src/core/runner/lifecycle';
import { acquireProfileLock, cleanupStaleLocks } from '../../src/core/runner/locks';
import { StreamSignalParser } from '../../src/core/runner/stream-parser';

const originalEnv = { ...process.env };

interface Harness {
  root: string;
  appPaths: ReturnType<typeof resolveAppPaths>;
  db: ReturnType<typeof openAppDatabase>;
  service: AccountService;
  account: Account;
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function setupHarness(): Harness {
  const root = temporaryDirectory();
  process.env.DSW_DATA_HOME = path.join(root, 'data');
  process.env.DSW_CONFIG_HOME = path.join(root, 'config');
  process.env.PATH = `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`;

  fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'bin', 'devin'),
    `#!/bin/sh\nexec "${path.resolve('node_modules/.bin/tsx')}" "${path.resolve('scripts/fake-devin.ts')}" "$@"\n`,
    { mode: 0o755 }
  );

  const appPaths = resolveAppPaths(process.env);
  const db = openAppDatabase({ paths: appPaths });
  const service = new AccountService(db, appPaths);
  const account = service.create('primary');
  service.markReady(account.id);
  fs.writeFileSync(resolveProfilePaths(account.id, appPaths).credentialsPath, 'token = "devin-session-token$secret"\n', {
    mode: 0o600
  });

  return { root, appPaths, db, service, account };
}

describe('devin runner integration', () => {
  it('marks quota_exhausted accounts limited and polls quota immediately', async () => {
    const harness = setupHarness();
    const server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ daily_remaining_pct: 0, weekly_remaining_pct: 50, daily_reset_at: 2_000 }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind quota fixture server');
    }

    process.env.DSW_FAKE_DEVIN_SCENARIO = 'quota_exhausted';
    process.env.DSW_ALLOW_INSECURE = '1';
    process.env.DSW_QUOTA_ENDPOINT_URL = `http://127.0.0.1:${address.port}/quota`;

    try {
      const exitCode = await runDevinWithAccount({ account: harness.account, args: ['-p', 'echo hi'], strategy: 'manual' });
      const updated = harness.service.getById(harness.account.id);
      const quotaPoll = harness.db
        .prepare("SELECT kind FROM events WHERE kind = 'quota_poll' AND account_id = ?")
        .get(harness.account.id);

      expect(exitCode).toBe(0);
      expect(updated.status).toBe('limited');
      expect(updated.status_reason).toBe('quota_snapshot:zero_remaining');
      expect(quotaPoll).toEqual({ kind: 'quota_poll' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.db.close();
    }
  });

  it('records cooldowns without marking rate-limited output as exhausted', async () => {
    const harness = setupHarness();
    process.env.DSW_FAKE_DEVIN_SCENARIO = 'rate_limited_then_completed';

    const exitCode = await runDevinWithAccount({ account: harness.account, args: ['-p', 'echo hi'], strategy: 'manual' });
    const updated = harness.service.getById(harness.account.id);
    const cooldown = harness.db.prepare('SELECT reason FROM limit_cooldowns WHERE account_id = ?').get(harness.account.id);

    expect(exitCode).toBe(0);
    expect(updated.status).toBe('ready');
    expect(cooldown).toEqual({ reason: 'output:rate_limited' });
    harness.db.close();
  });

  it('does not treat turn limit output as profile quota exhaustion', async () => {
    const harness = setupHarness();
    process.env.DSW_FAKE_DEVIN_SCENARIO = 'turn_limit';

    const exitCode = await runDevinWithAccount({ account: harness.account, args: ['-p', 'echo hi'], strategy: 'manual' });
    const updated = harness.service.getById(harness.account.id);

    expect(exitCode).toBe(0);
    expect(updated.status).toBe('ready');
    expect(updated.status_reason).toBeNull();
    harness.db.close();
  });

  it('redacts credential material before streaming Devin output to the terminal', async () => {
    const harness = setupHarness();
    process.env.DSW_FAKE_DEVIN_SCENARIO = 'leak_token';
    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      const exitCode = await runDevinWithAccount({ account: harness.account, args: ['-p', 'echo hi'], strategy: 'manual' });
      expect(exitCode).toBe(0);
      expect(writes.join('')).not.toContain('devin-session-token$secret');
      expect(writes.join('')).toContain('[REDACTED_AUTH]');
    } finally {
      process.stdout.write = originalWrite;
      harness.db.close();
    }
  });

  it('redacts and parses lines split across stream chunks', () => {
    const parser = new StreamSignalParser();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(chunk.toString());
        callback();
      }
    });
    const stream = new RedactedLineStream(output, parser, 'split-session');

    stream.write(Buffer.from('authorization: devin-session-token$'));
    stream.write(Buffer.from('secret\n{"type":"session_finished","finish_reason":"quota_'));
    stream.write(Buffer.from('exhausted"}\n'));
    stream.flush();

    expect(writes.join('')).not.toContain('devin-session-token$secret');
    expect(writes.join('')).toContain('[REDACTED_AUTH]');
    expect(parser.getPrimaryDecision()).toEqual({ kind: 'limited', reason: 'finish_reason:quota_exhausted' });
  });

  it('bounds newline-free runner output without leaking oversized content', () => {
    const parser = new StreamSignalParser();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(chunk.toString());
        callback();
      }
    });
    const stream = new RedactedLineStream(output, parser, 'oversized-session');

    stream.write(Buffer.from(`authorization: devin-session-token$${'a'.repeat(20_000)}`));
    stream.write(Buffer.from('still-secret\n{"type":"session_finished","finish_reason":"completed"}\n'));
    stream.flush();

    const terminalOutput = writes.join('');
    expect(terminalOutput).toContain('[DSW: redacted oversized line without newline]');
    expect(terminalOutput).not.toContain('devin-session-token$');
    expect(terminalOutput).not.toContain('still-secret');
  });

  it('bounds oversized newline-terminated runner output', () => {
    const parser = new StreamSignalParser();
    const writes: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        writes.push(chunk.toString());
        callback();
      }
    });
    const stream = new RedactedLineStream(output, parser, 'oversized-newline-session');

    stream.write(Buffer.from(`authorization: devin-session-token$${'a'.repeat(20_000)}\n`));
    stream.flush();

    const terminalOutput = writes.join('');
    expect(terminalOutput).toBe('[DSW: redacted oversized line]\n');
    expect(terminalOutput).not.toContain('devin-session-token$');
  });

  it('stores redacted command summaries', async () => {
    const harness = setupHarness();
    process.env.DSW_FAKE_DEVIN_SCENARIO = 'completed';

    await runDevinWithAccount({
      account: harness.account,
      args: ['-p', 'authorization: devin-session-token$secret'],
      strategy: 'manual'
    });
    const session = harness.db.prepare('SELECT command_summary FROM sessions ORDER BY started_at DESC LIMIT 1').get() as {
      command_summary: string;
    };

    expect(session.command_summary).not.toContain('devin-session-token$secret');
    expect(session.command_summary).toContain('[REDACTED_AUTH]');
    harness.db.close();
  });

  it('persists non-limited structured finish reasons', async () => {
    const harness = setupHarness();
    process.env.DSW_FAKE_DEVIN_SCENARIO = 'completed';

    await runDevinWithAccount({ account: harness.account, args: ['-p', 'echo hi'], strategy: 'manual' });
    const session = harness.db.prepare('SELECT finish_reason FROM sessions ORDER BY started_at DESC LIMIT 1').get() as {
      finish_reason: string | null;
    };

    expect(session.finish_reason).toBe('completed');
    harness.db.close();
  });


  it('cleans stale locks left by crashed sessions', () => {
    const harness = setupHarness();
    harness.db
      .prepare('INSERT INTO sessions (id, account_id, started_at, strategy) VALUES (?, ?, ?, ?)')
      .run('dead-session', harness.account.id, 1, 'manual');
    acquireProfileLock(harness.db, harness.account.id, 'dead-session', 999_999, 100);

    expect(cleanupStaleLocks(harness.db, 300, 120)).toBe(1);
    expect(harness.db.prepare('SELECT account_id FROM profile_locks WHERE account_id = ?').get(harness.account.id)).toBeUndefined();
    harness.db.close();
  });
});
