import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { openBrowser } from '../../src/server';

describe('browser opener', () => {
  it('handles opener spawn failures without throwing', () => {
    const child = new EventEmitter() as ChildProcess;
    child.unref = vi.fn(() => child);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      openBrowser('http://127.0.0.1:3000', (() => child) as never);
      child.emit('error', new Error('missing opener'));
    }).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unable to open browser automatically'));

    warn.mockRestore();
  });
});
