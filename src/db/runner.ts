import type Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface MigrationRow {
  version: string;
  checksum: string;
}

export function runMigrations(db: Database.Database, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()
    : [];

  const applied = new Map<string, string>();
  const rows = db.prepare('SELECT version, checksum FROM schema_migrations').all() as MigrationRow[];
  for (const row of rows) {
    applied.set(row.version, row.checksum);
  }

  const insert = db.prepare('INSERT INTO schema_migrations (version, checksum, applied_at) VALUES (?, ?, ?)');

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const existingChecksum = applied.get(file);

    if (existingChecksum && existingChecksum !== checksum) {
      throw new Error(`Migration checksum mismatch for ${file}`);
    }
    if (existingChecksum) {
      continue;
    }

    const apply = db.transaction(() => {
      db.exec(sql);
      insert.run(file, checksum, Math.floor(Date.now() / 1000));
    });
    apply();
  }
}
