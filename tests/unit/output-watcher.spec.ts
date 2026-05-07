import { describe, expect, it } from 'vitest';
import { OutputWatcher } from '../../src/core/output-watcher';

describe('OutputWatcher', () => {
  it('detects exhausted quota output', () => {
    const watcher = new OutputWatcher();

    expect(watcher.push('Your daily usage quota has been exhausted.')).toBe('quota');
  });

  it('ignores non-exhausted quota status text', () => {
    const watcher = new OutputWatcher();

    expect(watcher.push('Quota used: 20% (remaining: 80%)')).toBeNull();
  });

  it('detects Devin internal error output as recoverable', () => {
    const watcher = new OutputWatcher();

    expect(watcher.push('Something went wrong\n  An internal error occurred. Send a message to retry')).toBe('recoverable-error');
  });

  it('detects recoverable output split across PTY chunks', () => {
    const watcher = new OutputWatcher();

    expect(watcher.push('Something went wrong\n')).toBeNull();
    expect(watcher.push('  An internal error occurred. Send a message to retry')).toBe('recoverable-error');
  });
});
