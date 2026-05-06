import type { FastifyInstance } from 'fastify';
import { AccountService } from '../../core/accounts/service';
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
      return new AccountService(db).list();
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
