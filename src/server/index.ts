import crypto from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import { resolveAppPaths } from '../config/paths';
import { ensureAppDirs } from '../db/client';
import { registerStaticUiRoutes } from './static-ui';
import { registerAccountRoutes } from './routes/accounts';
import { registerEventRoutes } from './routes/events';
import { registerHealthRoutes } from './routes/health';
import { registerSessionRoutes } from './routes/sessions';
import { registerSettingsRoutes } from './routes/settings';

export interface CreateServerOptions {
  requireToken?: boolean;
  oneShotToken?: string;
}

interface OneShotToken {
  token: string;
  expiresAt: number;
  used: boolean;
}

export function ensureUiToken(tokenPath = resolveAppPaths().uiTokenPath): string {
  const paths = resolveAppPaths();
  ensureAppDirs(paths);

  if (fs.existsSync(tokenPath)) {
    return fs.readFileSync(tokenPath, 'utf8').trim();
  }

  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const token = ensureUiToken();
  const oneShot: OneShotToken | null = options.oneShotToken
    ? { token: options.oneShotToken, expiresAt: Date.now() + 60_000, used: false }
    : null;
  const publicRoutes = new Set(['/', '/ui.js', '/styles.css', '/favicon.ico', '/api/health', '/api/auth/exchange']);

  app.addHook('onRequest', async (request, reply) => {
    const remote = request.socket.remoteAddress;
    const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!loopback) {
      await reply.code(403).send({ error: 'loopback_only' });
      return;
    }

    const routePath = request.url.split('?')[0] ?? request.url;
    if (options.requireToken === false || publicRoutes.has(routePath)) {
      return;
    }

    if (request.headers['x-dsw-token'] !== token) {
      await reply.code(401).send({ error: 'unauthorized' });
      return;
    }
  });

  await registerStaticUiRoutes(app);
  app.post<{ Body: { token?: string } }>('/api/auth/exchange', async (request, reply) => {
    if (!oneShot || oneShot.used || Date.now() > oneShot.expiresAt || request.body?.token !== oneShot.token) {
      return reply.code(401).send({ error: 'invalid_or_expired_token' });
    }
    oneShot.used = true;
    return { token };
  });
  await registerHealthRoutes(app);
  await registerAccountRoutes(app);
  await registerSessionRoutes(app);
  await registerEventRoutes(app);
  await registerSettingsRoutes(app);
  return app;
}

export async function startServer(port: number): Promise<{ app: FastifyInstance; port: number; url: string; launchToken: string }> {
  const launchToken = crypto.randomBytes(24).toString('hex');
  const app = await createServer({ oneShotToken: launchToken });
  const address = await app.listen({ host: '127.0.0.1', port });
  const parsed = new URL(address);
  const boundPort = Number(parsed.port);
  return { app, port: boundPort, url: `http://127.0.0.1:${boundPort}/?t=${launchToken}`, launchToken };
}

type BrowserSpawn = (command: string, args: string[], options: { detached: true; stdio: 'ignore' }) => ChildProcess;

export function openBrowser(url: string, spawnImpl: BrowserSpawn = spawn): void {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawnImpl(command, args, { detached: true, stdio: 'ignore' });
  child.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`dsw: unable to open browser automatically: ${message}`);
    console.warn(`dsw: open this URL manually: ${url}`);
  });
  child.unref();
}
