import { redactText } from '../util/redact';
import type { Account } from './store';
import { loadPty, type PtyModule } from './pty-loader';

export interface QuotaPtyProbeOptions {
  env: NodeJS.ProcessEnv;
  baseEnv?: NodeJS.ProcessEnv;
  timeoutMs: number;
  startupDelayMs: number;
}

export interface QuotaPtyProbeResult {
  raw: string;
  timedOut: boolean;
  exitCode: number | null;
}

export async function probeQuotaViaPty(account: Account, options: QuotaPtyProbeOptions): Promise<QuotaPtyProbeResult> {
  const loaded = await loadPty();
  if (!loaded.ok || !loaded.pty) {
    return {
      raw: `PTY unavailable: ${loaded.reason ?? 'node-pty unavailable'}`,
      timedOut: false,
      exitCode: null
    };
  }

  return await runProbe(loaded.pty, account, options);
}

function runProbe(pty: PtyModule, account: Account, options: QuotaPtyProbeOptions): Promise<QuotaPtyProbeResult> {
  return new Promise((resolve) => {
    let raw = '';
    let finished = false;
    let exitCode: number | null = null;
    const term = pty.spawn('devin', [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: process.cwd(),
      env: {
        ...options.env,
        NO_COLOR: '1',
        TERM: 'xterm-256color',
        DSW_FAKE_PTY: options.baseEnv?.DSW_FAKE_PTY ?? '1'
      }
    });

    const finish = (timedOut: boolean): void => {
      if (finished) return;
      finished = true;
      clearTimeout(startupTimer);
      clearTimeout(deadlineTimer);
      try {
        term.write('/exit\r');
        term.kill();
      } catch {
        // Best effort cleanup.
      }
      resolve({ raw: redactText(raw), timedOut, exitCode: exitCode ?? (hasQuotaSignal(raw) ? 0 : null) });
    };

    const startupTimer = setTimeout(() => {
      try {
        term.write('/usage\r');
      } catch (error) {
        raw += `\nFailed to write /usage for ${account.name}: ${messageFor(error)}`;
        finish(false);
      }
    }, options.startupDelayMs);

    const deadlineTimer = setTimeout(() => finish(true), options.timeoutMs);

    term.onData((chunk) => {
      raw += chunk;
      if (hasQuotaSignal(raw)) finish(false);
    });
    term.onExit(({ exitCode: code }) => {
      exitCode = code;
      if (!hasQuotaSignal(raw)) finish(false);
    });
  });
}

function hasQuotaSignal(output: string): boolean {
  return /Quota used:|Quota resets|quota has been exhausted|quota exhausted|not logged in/i.test(output);
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
