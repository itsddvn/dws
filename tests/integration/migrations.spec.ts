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
});
