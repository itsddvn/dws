import type { FastifyInstance } from 'fastify';
import { openAppDatabase } from '../../db/client';

type SettingsBody = Record<string, unknown>;

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', async () => {
    const db = openAppDatabase();
    try {
      const rows = db.prepare('SELECT key, value_json FROM settings ORDER BY key').all() as Array<{
        key: string;
        value_json: string;
      }>;
      return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value_json) as unknown]));
    } finally {
      db.close();
    }
  });

  app.put<{ Body: SettingsBody }>('/api/settings', async (request) => {
    const db = openAppDatabase();
    try {
      const now = Math.floor(Date.now() / 1000);
      const upsert = db.prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at`
      );
      for (const [key, value] of Object.entries(request.body ?? {})) {
        upsert.run(key, JSON.stringify(value), now);
      }
      return { ok: true };
    } finally {
      db.close();
    }
  });
}
