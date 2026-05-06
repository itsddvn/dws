import type { FastifyInstance } from 'fastify';
import { openAppDatabase } from '../../db/client';

interface EventsQuery {
  account?: string;
  since?: string;
}

export async function registerEventRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EventsQuery }>('/api/events', async (request) => {
    const db = openAppDatabase();
    try {
      const since = request.query.since ? Number(request.query.since) : 0;
      if (request.query.account) {
        return db
          .prepare('SELECT * FROM events WHERE account_id = ? AND at >= ? ORDER BY at DESC, id DESC LIMIT 200')
          .all(request.query.account, since);
      }
      return db.prepare('SELECT * FROM events WHERE at >= ? ORDER BY at DESC, id DESC LIMIT 200').all(since);
    } finally {
      db.close();
    }
  });
}
