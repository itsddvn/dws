import { EventEmitter } from 'node:events';
import { redactText } from '../../db/redact';

const MAX_LINES = 200;
const tails = new Map<string, string[]>();
const emitter = new EventEmitter();

export function appendSessionTail(sessionId: string, line: string): void {
  const redacted = redactText(line);
  const tail = tails.get(sessionId) ?? [];
  tail.push(redacted);
  if (tail.length > MAX_LINES) {
    tail.splice(0, tail.length - MAX_LINES);
  }
  tails.set(sessionId, tail);
  emitter.emit(sessionId, redacted);
}

export function getSessionTail(sessionId: string): string[] {
  return [...(tails.get(sessionId) ?? [])];
}

export function subscribeSessionTail(sessionId: string, listener: (line: string) => void): () => void {
  emitter.on(sessionId, listener);
  return () => {
    emitter.off(sessionId, listener);
  };
}
