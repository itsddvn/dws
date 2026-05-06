import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { runMigrations } from './runner';

export interface OpenDatabaseOptions {
  paths?: AppPaths;
  migrate?: boolean;
}

export function ensureAppDirs(paths: AppPaths): void {
  fs.mkdirSync(paths.appDataDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.appConfigDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });
}

export function openAppDatabase(options: OpenDatabaseOptions = {}): Database.Database {
  const paths = options.paths ?? resolveAppPaths();
  ensureAppDirs(paths);

  const db = new Database(paths.dbPath);
  try {
    fs.chmodSync(paths.dbPath, 0o600);
  } catch {
    // chmod can fail on some filesystems; permissions are also asserted by doctor later.
  }
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (options.migrate !== false) {
    runMigrations(db, resolveMigrationsDir());
  }

  return db;
}

function resolveMigrationsDir(): string {
  const builtDir = path.join(__dirname, 'migrations');
  if (fs.existsSync(builtDir)) {
    return builtDir;
  }

  const sourceDir = path.resolve(__dirname, '..', '..', '..', 'src', 'db', 'migrations');
  if (fs.existsSync(sourceDir)) {
    return sourceDir;
  }

  return builtDir;
}
