import { resolveAppPaths, type AppPaths } from '../config/paths';
import { runCapture, type RunOptions } from '../util/exec';
import { redactText } from '../util/redact';
import { buildProfileEnv } from './profile-env';
import type { Account } from './store';

export interface QuotaSummary {
  tier?: string;
  usedPercent?: string;
  remainingPercent?: string;
  resetsIn?: string;
  resetAt?: string;
}

export interface AccountQuota {
  account: Account;
  status: 'ok' | 'needs-login' | 'exhausted' | 'timeout' | 'error';
  summary: QuotaSummary;
  rawRedacted: string;
  exitCode: number | null;
}

export interface ReadQuotaOptions {
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
  runImpl?: typeof runCapture;
  timeoutMs?: number;
  startupDelayMs?: number;
}

export async function readQuotaForAccount(account: Account, options: ReadQuotaOptions = {}): Promise<AccountQuota> {
  if (account.needsLogin) {
    return {
      account,
      status: 'needs-login',
      summary: {},
      rawRedacted: '',
      exitCode: null
    };
  }

  const appPaths = options.appPaths ?? resolveAppPaths();
  const runImpl = options.runImpl ?? runCapture;
  const baseEnv = options.baseEnv ?? process.env;
  const timeoutMs = options.timeoutMs ?? numberFromEnv(baseEnv.DSW_QUOTA_TIMEOUT_MS, 15_000);
  const startupDelayMs = options.startupDelayMs ?? numberFromEnv(baseEnv.DSW_QUOTA_STARTUP_DELAY_MS, 4_000);

  if (!options.runImpl && (await isTmuxAvailable(runImpl, options.baseEnv))) {
    return await readQuotaViaTmux(account, appPaths, baseEnv, timeoutMs, startupDelayMs, runImpl);
  }

  const runOptions: RunOptions = {
    env: buildProfileEnv(account.id, appPaths, baseEnv),
    timeoutMs
  };

  const result = await runImpl('devin', ['--print', '/usage'], runOptions);
  const raw = `${result.stdout}\n${result.stderr}`;
  const rawRedacted = redactText(raw).trim();
  const notLoggedIn = /not logged in/i.test(raw);
  const exhausted = /quota has been exhausted|quota exhausted/i.test(raw);
  const summary = parseQuotaSummary(raw);
  const zeroRemaining = parsePercent(summary.remainingPercent) === 0;

  return {
    account,
    status: exhausted || zeroRemaining ? 'exhausted' : result.timedOut ? 'timeout' : result.exitCode === 0 && !notLoggedIn ? 'ok' : 'error',
    summary,
    rawRedacted,
    exitCode: result.exitCode
  };
}

async function readQuotaViaTmux(
  account: Account,
  appPaths: AppPaths,
  baseEnv: NodeJS.ProcessEnv,
  timeoutMs: number,
  startupDelayMs: number,
  runImpl: typeof runCapture
): Promise<AccountQuota> {
  const env = buildProfileEnv(account.id, appPaths, baseEnv);
  const session = `dsw-quota-${process.pid}-${Date.now()}-${account.id.slice(0, 8)}`;
  let raw = '';
  let exitCode: number | null = null;
  let timedOut = false;

  try {
    const start = await runImpl(
      'tmux',
      [
        'new-session',
        '-d',
        '-s',
        session,
        '-x',
        '120',
        '-y',
        '40',
        '-c',
        process.cwd(),
        '-e',
        `XDG_DATA_HOME=${env.XDG_DATA_HOME ?? ''}`,
        '-e',
        `XDG_CONFIG_HOME=${env.XDG_CONFIG_HOME ?? ''}`,
        '-e',
        'NO_COLOR=1',
        '-e',
        'TERM=xterm-256color',
        '-e',
        `PATH=${baseEnv.PATH ?? process.env.PATH ?? ''}`,
        '-e',
        'DSW_FAKE_INTERACTIVE=1',
        'devin'
      ],
      { env: baseEnv, timeoutMs: 5_000 }
    );
    exitCode = start.exitCode;
    if (start.exitCode !== 0) {
      raw = `${start.stdout}\n${start.stderr}`;
      return quotaResult(account, raw, false, start.exitCode);
    }

    await delay(startupDelayMs);
    await runImpl('tmux', ['send-keys', '-t', session, '/usage', 'Enter'], { env: baseEnv, timeoutMs: 5_000 });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const capture = await runImpl('tmux', ['capture-pane', '-t', session, '-p', '-S', '-200'], { env: baseEnv, timeoutMs: 5_000 });
      raw = `${capture.stdout}\n${capture.stderr}`;
      if (hasQuotaSignal(raw)) return quotaResult(account, raw, false, 0);
      await delay(500);
    }
    timedOut = true;
    return quotaResult(account, raw, timedOut, exitCode);
  } finally {
    await runImpl('tmux', ['kill-session', '-t', session], { env: baseEnv, timeoutMs: 5_000 }).catch(() => undefined);
  }
}

function quotaResult(account: Account, raw: string, timedOut: boolean, exitCode: number | null): AccountQuota {
  const rawRedacted = redactText(raw).trim();
  const notLoggedIn = /not logged in/i.test(raw);
  const exhausted = /quota has been exhausted|quota exhausted/i.test(raw);
  const summary = parseQuotaSummary(raw);
  const zeroRemaining = parsePercent(summary.remainingPercent) === 0;

  return {
    account,
    status: exhausted || zeroRemaining ? 'exhausted' : timedOut ? 'timeout' : exitCode === 0 && !notLoggedIn ? 'ok' : 'error',
    summary,
    rawRedacted,
    exitCode
  };
}

async function isTmuxAvailable(runImpl: typeof runCapture, baseEnv: NodeJS.ProcessEnv | undefined): Promise<boolean> {
  try {
    const result = await runImpl('tmux', ['-V'], { env: baseEnv ?? process.env, timeoutMs: 2_000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

function hasQuotaSignal(output: string): boolean {
  return /Quota used:|Quota resets|quota has been exhausted|quota exhausted|not logged in/i.test(output);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePercent(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseQuotaSummary(output: string): QuotaSummary {
  const headline = output.match(/^(.+?)\s*(?:\u00b7|\||-)\s*(\d+%)\s+remaining(?:\s+\(resets in ([^)]+)\))?/im);
  const usage = output.match(/^\s*Quota used:\s*(\d+%)\s*\(remaining:\s*(\d+%)\)\s*$/im);
  const reset = output.match(/^\s*Quota resets\s+(.+?)\.?\s*$/im);
  const exhausted = /quota has been exhausted|quota exhausted/i.test(output);

  return {
    tier: cleanTier(headline?.[1]),
    usedPercent: usage?.[1]?.trim() ?? (exhausted ? '100%' : undefined),
    remainingPercent: usage?.[2]?.trim() ?? headline?.[2]?.trim() ?? (exhausted ? '0%' : undefined),
    resetsIn: headline?.[3]?.trim(),
    resetAt: reset?.[1]?.trim()
  };
}

function cleanTier(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().split(/\s{2,}/).pop()?.trim();
}
