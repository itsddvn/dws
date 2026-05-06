import type { FastifyInstance } from 'fastify';
import { openAppDatabase } from '../../db/client';

interface SessionParams {
  id: string;
}

export async function registerSessionRoutes(app: FastifyInstance): Promise<void> {
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
}
