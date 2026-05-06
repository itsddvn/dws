import type { FastifyInstance } from 'fastify';
import { AccountService } from '../../core/accounts/service';
import { runProfileLogin } from '../../core/profiles/login';
import { pollQuotaForAccount } from '../../core/quota/poller';
import { openAppDatabase } from '../../db/client';

interface AccountParams {
  id: string;
}

interface CreateAccountBody {
  name?: string;
}

interface MarkLimitedBody {
  until?: string;
  reason?: string;
}

export async function registerAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/accounts', async () => {
    const db = openAppDatabase();
    try {
      return db
        .prepare(
          `SELECT accounts.*,
                  latest_quota_snapshots.daily_remaining_pct,
                  latest_quota_snapshots.weekly_remaining_pct,
                  latest_quota_snapshots.daily_reset_at,
                  latest_quota_snapshots.weekly_reset_at,
                  latest_quota_snapshots.fetched_at AS quota_fetched_at
           FROM accounts
           LEFT JOIN latest_quota_snapshots ON latest_quota_snapshots.account_id = accounts.id
           ORDER BY accounts.order_index ASC, accounts.name ASC`
        )
        .all();
    } finally {
      db.close();
    }
  });

  app.post<{ Body: CreateAccountBody }>('/api/accounts', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const name = request.body?.name;
      if (!name) {
        return reply.code(400).send({ error: 'name_required' });
      }
      return reply.code(201).send(new AccountService(db).create(name));
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams }>('/api/accounts/:id/enable', async (request) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      return service.setEnabled(account.name, true);
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams }>('/api/accounts/:id/login', async (request) => {
    const db = openAppDatabase();
    try {
      const account = new AccountService(db).getById(request.params.id);
      await runProfileLogin(account.id);
      return { ok: true };
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams }>('/api/accounts/:id/disable', async (request) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      return service.setEnabled(account.name, false);
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams; Body: MarkLimitedBody }>('/api/accounts/:id/mark-limited', async (request) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      const until = request.body?.until ? Math.floor(Date.parse(request.body.until) / 1000) : null;
      return service.markLimited(account.name, request.body?.reason ?? 'manual', until);
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams }>('/api/accounts/:id/unmark', async (request) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      return service.unmark(account.name);
    } finally {
      db.close();
    }
  });

  app.post<{ Params: AccountParams }>('/api/accounts/:id/refresh-quota', async (request) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      const snapshot = await pollQuotaForAccount(db, service, account.id);
      return { ok: true, snapshot };
    } finally {
      db.close();
    }
  });

  app.delete<{ Params: AccountParams }>('/api/accounts/:id', async (request, reply) => {
    const db = openAppDatabase();
    try {
      const service = new AccountService(db);
      const account = service.getById(request.params.id);
      service.remove(account.name);
      return reply.code(204).send();
    } finally {
      db.close();
    }
  });
}
