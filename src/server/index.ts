import crypto from 'node:crypto';
import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import { resolveAppPaths } from '../config/paths';
import { ensureAppDirs } from '../db/client';
import { registerAccountRoutes } from './routes/accounts';
import { registerEventRoutes } from './routes/events';
import { registerHealthRoutes } from './routes/health';
import { registerSessionRoutes } from './routes/sessions';
import { registerSettingsRoutes } from './routes/settings';

export interface CreateServerOptions {
  requireToken?: boolean;
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

  app.addHook('onRequest', async (request, reply) => {
    const remote = request.socket.remoteAddress;
    const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    if (!loopback) {
      await reply.code(403).send({ error: 'loopback_only' });
      return;
    }

    if (options.requireToken === false || request.url === '/api/health') {
      return;
    }

    if (request.headers['x-dsw-token'] !== token) {
      await reply.code(401).send({ error: 'unauthorized' });
    }
  });

  await registerHealthRoutes(app);
  await registerAccountRoutes(app);
  await registerSessionRoutes(app);
  await registerEventRoutes(app);
  await registerSettingsRoutes(app);
  return app;
}

export async function startServer(port: number): Promise<{ app: FastifyInstance; port: number }> {
  const app = await createServer();
  const address = await app.listen({ host: '127.0.0.1', port });
  const parsed = new URL(address);
  return { app, port: Number(parsed.port) };
}
