import fs from 'node:fs';
import path from 'node:path';

/**
 * Write a JSON value to disk atomically: write to a sibling temp file with
 * 0o600 permissions, then rename onto the target path. Survives mid-write
 * SIGKILL or power loss without leaving a half-written file.
 */
export function atomicWriteJsonSync(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

/**
 * Read JSON from a file, returning `null` when the file is missing or
 * malformed. Never throws — callers are expected to treat absent/corrupt
 * state as "no data".
 */
export function readJsonOrNull<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}
