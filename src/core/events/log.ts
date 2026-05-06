import type Database from 'better-sqlite3';
import { redactJson } from '../../db/redact';

export function recordEvent(
  db: Database.Database,
  input: {
    kind: string;
    accountId?: string | null;
    sessionId?: string | null;
    payload?: unknown;
    at?: number;
  }
): void {
  db.prepare(
    `INSERT INTO events
      (account_id, session_id, at, kind, payload_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    input.accountId ?? null,
    input.sessionId ?? null,
    input.at ?? Math.floor(Date.now() / 1000),
    input.kind,
    input.payload === undefined ? null : JSON.stringify(redactJson(input.payload))
  );
}
