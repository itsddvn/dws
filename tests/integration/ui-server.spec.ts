import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { appendSessionTail, getSessionTail, subscribeSessionTail } from '../../src/core/runner/live-tail';
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

describe('local UI server', () => {
  it('serves static UI publicly but protects API routes', async () => {
    setupEnv();
    const app = await createServer({ oneShotToken: 'launch-token' });
    try {
      const page = await app.inject({ method: 'GET', url: '/' });
      expect(page.statusCode).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');

      const unauthorized = await app.inject({ method: 'GET', url: '/api/accounts' });
      expect(unauthorized.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('exchanges a launch token once for the persistent UI token', async () => {
    setupEnv();
    const expectedToken = ensureUiToken();
    const app = await createServer({ oneShotToken: 'launch-token' });
    try {
      const exchange = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        payload: { token: 'launch-token' }
      });
      expect(exchange.statusCode).toBe(200);
      expect(exchange.json()).toEqual({ token: expectedToken });

      const reuse = await app.inject({
        method: 'POST',
        url: '/api/auth/exchange',
        payload: { token: 'launch-token' }
      });
      expect(reuse.statusCode).toBe(401);

      const accounts = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: { 'x-dsw-token': expectedToken }
      });
      expect(accounts.statusCode).toBe(200);
      expect(accounts.json()).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('keeps live session tail lines redacted for SSE consumers', () => {
    const observed: string[] = [];
    const unsubscribe = subscribeSessionTail('session-1', (line) => observed.push(line));
    appendSessionTail('session-1', 'authorization: devin-session-token$secret');
    unsubscribe();

    expect(observed).toEqual(['authorization: [REDACTED_AUTH]']);
    expect(getSessionTail('session-1')).toEqual(['authorization: [REDACTED_AUTH]']);
  });
});
