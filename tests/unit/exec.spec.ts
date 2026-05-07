import { describe, expect, it } from 'vitest';
import { runCapture } from '../../src/util/exec';

describe('runCapture', () => {
  it('captures stdout and stderr separately', async () => {
    const result = await runCapture('node', ['-e', "console.log('out'); console.error('err');"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('out');
    expect(result.stderr.trim()).toBe('err');
    expect(result.timedOut).toBe(false);
  });

  it('marks timedOut and resolves even when the child ignores SIGTERM', async () => {
    // Spawn a node child that ignores SIGTERM and would otherwise hang
    // forever. The SIGKILL grace path must end the process.
    const script = `
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);
    `;
    const t0 = Date.now();
    const result = await runCapture('node', ['-e', script], { timeoutMs: 200, killAfterMs: 200 });
    const dt = Date.now() - t0;
    expect(result.timedOut).toBe(true);
    expect(dt).toBeLessThan(2000);
    // SIGKILL is delivered to the child; the resulting signal should
    // surface either via `signal` or a non-zero exit code.
    expect(result.exitCode === null || result.exitCode !== 0).toBe(true);
  });

  it('rejects when the binary cannot be spawned', async () => {
    await expect(runCapture('this-binary-should-not-exist-xyzzy', [])).rejects.toThrow();
  });
});
