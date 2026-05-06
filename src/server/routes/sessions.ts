import type { FastifyInstance } from 'fastify';
import { getEligibleAccounts } from '../../core/scheduler/eligibility';
import { getSessionTail, subscribeSessionTail } from '../../core/runner/live-tail';
import { runDevinWithAccount } from '../../core/runner/lifecycle';
import { selectNextAccount, type SelectionStrategy } from '../../core/scheduler/strategies';
import { openAppDatabase } from '../../db/client';
import { redactJson } from '../../db/redact';

interface SessionParams {
  id: string;
}

interface RunBody {
  account_id?: string;
  strategy?: SelectionStrategy;
  args?: string[];
}

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RunBody }>('/api/run', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const strategy = request.body?.strategy ?? 'quota-weighted';
      const args = Array.isArray(request.body?.args) ? request.body.args : [];
      let account;
      try {
        account = request.body?.account_id
          ? getEligibleAccounts(db).find((candidate) => candidate.id === request.body?.account_id)
          : selectNextAccount(db, strategy);
      } catch (error) {
        if (error instanceof Error && error.message === 'No eligible Devin profiles') {
          return reply.code(409).send({ error: 'account_not_eligible' });
        }
        throw error;
      }
      if (!account) {
        return reply.code(409).send({ error: 'account_not_eligible' });
      }

      void runDevinWithAccount({ account, args, strategy }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`dsw ui run failed: ${message}`);
      });
      return reply.code(202).send({ ok: true, account_id: account.id });
    } finally {
      db.close();
    }
  });

  app.get('/api/sessions', async () => {
    const db = openAppDatabase();
    try {
      return db
        .prepare(
          `SELECT sessions.*, accounts.name AS account_name
           FROM sessions
           JOIN accounts ON accounts.id = sessions.account_id
           ORDER BY sessions.started_at DESC
           LIMIT 100`
        )
        .all();
    } finally {
      db.close();
    }
  });

  app.get<{ Params: SessionParams }>('/api/sessions/:id', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const session = db
        .prepare(
          `SELECT sessions.*, accounts.name AS account_name
           FROM sessions
           JOIN accounts ON accounts.id = sessions.account_id
           WHERE sessions.id = ?`
        )
        .get(request.params.id);
      if (!session) {
        return reply.code(404).send({ error: 'session_not_found' });
      }
      return session;
    } finally {
      db.close();
    }
  });

  app.post<{ Params: SessionParams }>('/api/sessions/:id/stop', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const session = db.prepare('SELECT id, pid, ended_at FROM sessions WHERE id = ?').get(request.params.id) as
        | { id: string; pid: number | null; ended_at: number | null }
        | undefined;
      if (!session) {
        return reply.code(404).send({ error: 'session_not_found' });
      }
      if (!session.pid || session.ended_at) {
        return reply.code(409).send({ error: 'session_not_running' });
      }
      try {
        process.kill(session.pid, 'SIGTERM');
      } catch (error) {
        return reply.code(409).send({ error: 'kill_failed', message: error instanceof Error ? error.message : String(error) });
      }
      return { ok: true };
    } finally {
      db.close();
    }
  });

  app.get<{ Params: SessionParams }>('/api/sessions/:id/stream', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(request.params.id);
      if (!session) {
        return reply.code(404).send({ error: 'session_not_found' });
      }
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive'
      });

      const rows = db
        .prepare('SELECT at, kind, payload_json FROM events WHERE session_id = ? ORDER BY at ASC, id ASC LIMIT 200')
        .all(request.params.id) as Array<{ at: number; kind: string; payload_json: string | null }>;
      for (const row of rows) {
        writeSse(reply.raw, 'event', row);
      }
      for (const line of getSessionTail(request.params.id)) {
        writeSse(reply.raw, 'tail', { line });
      }
      const unsubscribe = subscribeSessionTail(request.params.id, (line) => {
        writeSse(reply.raw, 'tail', { line });
      });
      const heartbeat = setInterval(() => {
        writeSse(reply.raw, 'heartbeat', { at: Math.floor(Date.now() / 1000) });
      }, 15_000);
      request.raw.on('close', () => {
        unsubscribe();
        clearInterval(heartbeat);
      });
      return reply;
    } finally {
      db.close();
    }
  });
}

function writeSse(stream: NodeJS.WritableStream, event: string, data: unknown): void {
  stream.write(`event: ${event}\n`);
  stream.write(`data: ${JSON.stringify(redactJson(data))}\n\n`);
}
