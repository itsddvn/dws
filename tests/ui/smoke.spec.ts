import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';
import { AccountService } from '../../src/core/accounts/service';
import { createServer, ensureUiToken } from '../../src/server';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

function setupEnv(): void {
  const root = temporaryDirectory();
  process.env.DSW_DATA_HOME = path.join(root, 'data');
  process.env.DSW_CONFIG_HOME = path.join(root, 'config');
}

describe('UI smoke flows', () => {
  it('returns a conflict when no account is eligible for automatic UI runs', async () => {
    setupEnv();
    const token = ensureUiToken(resolveAppPaths(process.env).uiTokenPath);
    const app = await createServer();
    try {
      const blockedRun = await app.inject({
        method: 'POST',
        url: '/api/run',
        headers: { 'x-dsw-token': token },
        payload: { args: ['-p', 'echo hi'] }
      });

      expect(blockedRun.statusCode).toBe(409);
      expect(blockedRun.json()).toEqual({ error: 'account_not_eligible' });
    } finally {
      await app.close();
    }
  });

  it('covers login-required, accounts render data, manual mark-limited, and settings save', async () => {
    setupEnv();
    const paths = resolveAppPaths(process.env);
    const db = openAppDatabase({ paths });
    const service = new AccountService(db, paths);
    const account = service.create('primary');
    service.markReady(account.id);
    db.close();

    const token = ensureUiToken(paths.uiTokenPath);
    const app = await createServer();
    try {
      const blocked = await app.inject({ method: 'GET', url: '/api/accounts' });
      expect(blocked.statusCode).toBe(401);

      const accounts = await app.inject({ method: 'GET', url: '/api/accounts', headers: { 'x-dsw-token': token } });
      expect(accounts.statusCode).toBe(200);
      expect(accounts.json()).toMatchObject([{ name: 'primary', status: 'ready' }]);

      const markLimited = await app.inject({
        method: 'POST',
        url: `/api/accounts/${account.id}/mark-limited`,
        headers: { 'x-dsw-token': token },
        payload: { reason: 'manual', until: '2026-05-07T00:00:00.000Z' }
      });
      expect(markLimited.statusCode).toBe(200);
      expect(markLimited.json()).toMatchObject({ status: 'limited', status_reason: 'manual' });

      const blockedRun = await app.inject({
        method: 'POST',
        url: '/api/run',
        headers: { 'x-dsw-token': token },
        payload: { account_id: account.id, args: ['-p', 'echo hi'] }
      });
      expect(blockedRun.statusCode).toBe(409);
      expect(blockedRun.json()).toEqual({ error: 'account_not_eligible' });

      const settings = await app.inject({
        method: 'PUT',
        url: '/api/settings',
        headers: { 'x-dsw-token': token },
        payload: { selection_strategy: 'round-robin', quota_endpoint_enabled: false }
      });
      expect(settings.statusCode).toBe(200);
      expect(settings.json()).toEqual({ ok: true });

      const savedSettings = await app.inject({ method: 'GET', url: '/api/settings', headers: { 'x-dsw-token': token } });
      expect(savedSettings.json()).toMatchObject({ selection_strategy: 'round-robin', quota_endpoint_enabled: false });
    } finally {
      await app.close();
    }
  });
});
