import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';
import { AccountService } from '../../src/core/accounts/service';
import { classifySignal } from '../../src/core/quota/signals';
import { pollQuotaForAccount } from '../../src/core/quota/poller';
import { resolveProfilePaths } from '../../src/core/profiles/paths';
import { selectNextAccount, suggestManualAccount } from '../../src/core/scheduler/strategies';

function setupDb() {
  const root = temporaryDirectory();
  const paths = resolveAppPaths({
    ...process.env,
    DSW_DATA_HOME: path.join(root, 'data'),
    DSW_CONFIG_HOME: path.join(root, 'config')
  });
  const db = openAppDatabase({ paths });
  return { db, paths };
}

describe('scheduler and quota signals', () => {
  it('selects highest quota account by default', () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const low = service.create('low');
    const high = service.create('high');
    service.markReady(low.id);
    service.markReady(high.id);

    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(low.id, 1, 20, 20);
    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(high.id, 2, 90, 90);

    expect(selectNextAccount(db).name).toBe('high');
    db.close();
  });

  it('round robin skips limited accounts', () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const first = service.create('first');
    const second = service.create('second');
    service.markReady(first.id);
    service.markReady(second.id);
    service.markLimited('first', 'manual');

    expect(selectNextAccount(db, 'round-robin').name).toBe('second');
    db.close();
  });

  it('classifies quota and non-quota signals conservatively', () => {
    expect(classifySignal({ type: 'finish_reason', value: 'quota_exhausted' }).kind).toBe('limited');
    expect(classifySignal({ type: 'finish_reason', value: 'auth_required' }).kind).toBe('needs_login');
    expect(classifySignal({ type: 'output_line', value: 'Turn limit reached' }).kind).toBe('info');
    expect(classifySignal({ type: 'output_line', value: 'Rate limited: retry later' }).kind).toBe('cooldown');
  });

  it('manual strategy exposes a quota-weighted suggestion', () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const first = service.create('first');
    const second = service.create('second');
    service.markReady(first.id);
    service.markReady(second.id);

    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(first.id, 1, 80, 40);
    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(second.id, 2, 70, 70);

    const eligible = [first, second].map((account) => ({
      ...account,
      daily_remaining_pct: account.id === first.id ? 80 : 70,
      weekly_remaining_pct: account.id === first.id ? 40 : 70
    }));

    expect(suggestManualAccount(eligible).name).toBe('second');
    expect(selectNextAccount(db, 'manual').name).toBe('second');
    db.close();
  });

  it('excludes accounts at zero quota', () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const empty = service.create('empty');
    const usable = service.create('usable');
    service.markReady(empty.id);
    service.markReady(usable.id);

    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(empty.id, 1, 0, 90);
    db.prepare(
      `INSERT INTO quota_snapshots
        (account_id, fetched_at, source, daily_remaining_pct, weekly_remaining_pct)
       VALUES (?, ?, 'manual', ?, ?)`
    ).run(usable.id, 2, 30, 30);

    expect(selectNextAccount(db).name).toBe('usable');
    db.close();
  });

  it('polls quota, persists a snapshot, and marks zero quota limited', async () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const account = service.create('primary');
    service.markReady(account.id);
    const profilePaths = resolveProfilePaths(account.id, paths);
    fs.writeFileSync(profilePaths.credentialsPath, 'token = "devin-session-token$secret"\n', { mode: 0o600 });

    const snapshot = await pollQuotaForAccount(db, service, account.id, {
      endpointUrl: 'https://example.test/quota',
      appPaths: paths,
      now: 10,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({
            daily_remaining_pct: 0,
            weekly_remaining_pct: 50,
            daily_reset_at: 20,
            token: 'devin-session-token$secret'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )) as typeof fetch
    });

    const event = db.prepare('SELECT kind, payload_json FROM events ORDER BY id DESC LIMIT 1').get() as {
      kind: string;
      payload_json: string;
    };
    if (!snapshot) {
      throw new Error(JSON.stringify(event));
    }
    const updated = service.getById(account.id);

    expect(snapshot.daily_remaining_pct).toBe(0);
    expect(updated.status).toBe('limited');
    expect(updated.limited_until).toBe(20);
    expect(event.kind).toBe('quota_poll');
    expect(event.payload_json).not.toContain('secret');
    db.close();
  });

  it('keeps manual limited status after a successful quota poll', async () => {
    const { db, paths } = setupDb();
    const service = new AccountService(db, paths);
    const account = service.create('primary');
    service.markLimited('primary', 'manual', 30);
    fs.writeFileSync(resolveProfilePaths(account.id, paths).credentialsPath, 'token = "devin-session-token$secret"\n', {
      mode: 0o600
    });

    await pollQuotaForAccount(db, service, account.id, {
      endpointUrl: 'https://example.test/quota',
      appPaths: paths,
      now: 10,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ daily_remaining_pct: 90, weekly_remaining_pct: 90 }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })) as typeof fetch
    });

    const updated = service.getById(account.id);
    expect(updated.status).toBe('limited');
    expect(updated.status_reason).toBe('manual');
    expect(updated.limited_until).toBe(30);
    db.close();
  });
});
