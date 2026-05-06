import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';

describe('database migrations', () => {
  it('creates the baseline tables in an isolated app dir', () => {
    const root = temporaryDirectory();
    const paths = resolveAppPaths({
      ...process.env,
      DSW_DATA_HOME: path.join(root, 'data'),
      DSW_CONFIG_HOME: path.join(root, 'config')
    });

    const db = openAppDatabase({ paths });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    db.close();

    expect(tables).toContain('accounts');
    expect(tables).toContain('quota_snapshots');
    expect(tables).toContain('sessions');
    expect(tables).toContain('profile_locks');
    expect(tables).toContain('events');
    expect(tables).toContain('settings');
    expect(tables).toContain('latest_quota_snapshots');
    expect(fs.existsSync(paths.dbPath)).toBe(true);
  });

  it('opens an existing empty database and applies all migrations', () => {
    const root = temporaryDirectory();
    const paths = resolveAppPaths({
      ...process.env,
      DSW_DATA_HOME: path.join(root, 'data'),
      DSW_CONFIG_HOME: path.join(root, 'config')
    });

    openAppDatabase({ paths, migrate: false }).close();
    const db = openAppDatabase({ paths });
    const migration = db
      .prepare("SELECT version FROM schema_migrations WHERE version = '001_init.sql'")
      .get() as { version: string } | undefined;
    const accountsTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accounts'")
      .get() as { name: string } | undefined;
    db.close();

    expect(migration).toEqual({ version: '001_init.sql' });
    expect(accountsTable).toEqual({ name: 'accounts' });
  });
});
