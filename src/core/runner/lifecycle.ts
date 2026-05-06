import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { openAppDatabase } from '../../db/client';
import { redactText } from '../../db/redact';
import { AccountService, type Account } from '../accounts/service';
import { recordEvent } from '../events/log';
import { buildProfileEnv } from '../profiles/env';
import { pollQuotaForAccount } from '../quota/poller';
import { acquireProfileLock, heartbeatProfileLock, releaseProfileLock } from './locks';
import { StreamSignalParser } from './stream-parser';

export interface RunDevinOptions {
  account: Account;
  args: string[];
  strategy: string;
}

export async function runDevinWithAccount(options: RunDevinOptions): Promise<number | null> {
  const db = openAppDatabase();
  const accountService = new AccountService(db);
  const sessionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    `INSERT INTO sessions
      (id, account_id, started_at, strategy, command_summary)
     VALUES (?, ?, ?, ?, ?)`
  ).run(sessionId, options.account.id, now, options.strategy, summarizeCommand(options.args));
  recordEvent(db, {
    kind: 'session_start',
    accountId: options.account.id,
    sessionId,
    at: now,
    payload: { strategy: options.strategy, command_summary: summarizeCommand(options.args) }
  });

  const parser = new StreamSignalParser();
  const child = spawn('devin', options.args, {
    env: buildProfileEnv(options.account.id),
    stdio: ['inherit', 'pipe', 'pipe']
  });

  if (!child.pid) {
    throw new Error('Failed to spawn devin');
  }

  db.prepare('UPDATE sessions SET pid = ? WHERE id = ?').run(child.pid, sessionId);
  acquireProfileLock(db, options.account.id, sessionId, child.pid);

  const heartbeat = setInterval(() => {
    heartbeatProfileLock(db, options.account.id);
  }, 30_000);

  child.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(chunk);
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line) {
        parser.ingestLine(redactText(line));
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk);
    for (const line of chunk.toString('utf8').split(/\r?\n/)) {
      if (line) {
        parser.ingestLine(redactText(line));
      }
    }
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });

  clearInterval(heartbeat);
  parser.ingestExit(exitCode);
  const decision = parser.getPrimaryDecision();
  const endedAt = Math.floor(Date.now() / 1000);

  if (decision.kind === 'limited') {
    accountService.markAccountLimited(options.account.id, decision.reason);
    recordEvent(db, { kind: 'auto_mark_limited', accountId: options.account.id, sessionId, payload: decision });
  } else if (decision.kind === 'needs_login') {
    accountService.markNeedsLogin(options.account.id, decision.reason);
    recordEvent(db, { kind: 'auto_mark_needs_login', accountId: options.account.id, sessionId, payload: decision });
  } else if (decision.kind === 'cooldown') {
    db.prepare(
      `INSERT INTO limit_cooldowns
        (account_id, reason, until_at, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET
        reason = excluded.reason,
        until_at = excluded.until_at,
        created_at = excluded.created_at`
    ).run(options.account.id, decision.reason, endedAt + decision.seconds, endedAt);
    recordEvent(db, { kind: 'rate_limit_cooldown', accountId: options.account.id, sessionId, payload: decision });
  } else if (exitCode === 0) {
    accountService.markReady(options.account.id);
  }

  db.prepare(
    `UPDATE sessions
     SET ended_at = ?, exit_code = ?, finish_reason = ?, notes = ?
     WHERE id = ?`
  ).run(endedAt, exitCode, decision.kind === 'limited' ? 'quota_exhausted' : null, decision.kind, sessionId);
  db.prepare('UPDATE accounts SET last_used_at = ? WHERE id = ?').run(endedAt, options.account.id);
  recordEvent(db, {
    kind: 'session_end',
    accountId: options.account.id,
    sessionId,
    at: endedAt,
    payload: { exit_code: exitCode, decision }
  });
  await pollQuotaForAccount(db, accountService, options.account.id);
  releaseProfileLock(db, options.account.id);
  db.close();

  return exitCode;
}

function summarizeCommand(args: string[]): string {
  if (args.length === 0) {
    return 'devin';
  }
  return `devin ${args.join(' ')}`.slice(0, 500);
}
