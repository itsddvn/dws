import { resolveAppPaths, type AppPaths } from '../config/paths';
import { runCapture, type RunOptions } from '../util/exec';
import { redactText } from '../util/redact';
import { buildProfileEnv, buildProfileEnvWithoutRuntime } from './profile-env';
import { probeQuotaViaPty } from './quota-pty-probe';
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
  transport?: 'auto' | 'pty' | 'print';
  prepareRuntime?: boolean;
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
  const transport = options.transport ?? 'auto';
  const env = buildQuotaEnv(account.id, appPaths, baseEnv, options.prepareRuntime ?? true);

  if (transport === 'auto' || transport === 'pty') {
    if (!options.runImpl) {
      const result = await probeQuotaViaPty(account, {
        env,
        baseEnv,
        timeoutMs,
        startupDelayMs
      });
      return quotaResult(account, result.raw, result.timedOut, result.exitCode);
    }
  }

  const runOptions: RunOptions = {
    env,
    timeoutMs
  };

  const result = await runImpl('devin', ['--print', '/usage'], runOptions);
  const raw = `${result.stdout}\n${result.stderr}`;
  const rawRedacted = redactText(raw).trim();
  const notLoggedIn = /not logged in/i.test(raw);
  const exhausted = /quota has been exhausted|quota exhausted/i.test(raw);
  const summary = parseQuotaSummary(raw);
  const zeroRemaining = parsePercent(summary.remainingPercent) === 0;
  warnOnUnparseable(account, result.exitCode, notLoggedIn, exhausted, summary);

  return {
    account,
    status: exhausted || zeroRemaining ? 'exhausted' : result.timedOut ? 'timeout' : result.exitCode === 0 && !notLoggedIn ? 'ok' : 'error',
    summary,
    rawRedacted,
    exitCode: result.exitCode
  };
}

function buildQuotaEnv(
  profileId: string,
  appPaths: AppPaths,
  baseEnv: NodeJS.ProcessEnv,
  prepareRuntime: boolean
): NodeJS.ProcessEnv {
  return prepareRuntime
    ? buildProfileEnv(profileId, appPaths, baseEnv)
    : buildProfileEnvWithoutRuntime(profileId, appPaths, baseEnv);
}

function quotaResult(account: Account, raw: string, timedOut: boolean, exitCode: number | null): AccountQuota {
  const rawRedacted = redactText(raw).trim();
  const notLoggedIn = /not logged in/i.test(raw);
  const exhausted = /quota has been exhausted|quota exhausted/i.test(raw);
  const summary = parseQuotaSummary(raw);
  const zeroRemaining = parsePercent(summary.remainingPercent) === 0;
  if (!timedOut) warnOnUnparseable(account, exitCode, notLoggedIn, exhausted, summary);

  return {
    account,
    status: exhausted || zeroRemaining ? 'exhausted' : timedOut ? 'timeout' : exitCode === 0 && !notLoggedIn ? 'ok' : 'error',
    summary,
    rawRedacted,
    exitCode
  };
}

let unparseableWarningEmitted = false;
function warnOnUnparseable(
  account: Account,
  exitCode: number | null,
  notLoggedIn: boolean,
  exhausted: boolean,
  summary: QuotaSummary
): void {
  if (unparseableWarningEmitted) return;
  if (exitCode !== 0 || notLoggedIn || exhausted) return;
  if (summaryHasUsableFields(summary)) return;
  unparseableWarningEmitted = true;
  process.stderr.write(
    `dsw: warning: parsed no quota fields from devin output for ${account.name}. ` +
      `The Devin /usage wording may have changed. ` +
      `Run \`dsw quota\` to inspect the redacted raw output.\n`
  );
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

/**
 * Parse the `/usage` output that Devin's interactive REPL prints. The
 * patterns below are anchored to the wording observed in the real Devin
 * CLI (last verified against `devin 0.x` outputs in May 2026):
 *
 *   Trial · 100% remaining (resets in 5h 41m)
 *   Quota used: 0% (remaining: 100%)
 *   Quota resets May 7, 3:00 PM (UTC+7).
 *
 * If Devin changes any of those phrasings, the regexes below need
 * updating; the consumer (`readQuotaForAccount`) emits a warning when a
 * 0-exit response yields no parseable fields.
 */
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

export function summaryHasUsableFields(summary: QuotaSummary): boolean {
  return Boolean(summary.tier || summary.usedPercent || summary.remainingPercent || summary.resetsIn || summary.resetAt);
}

function cleanTier(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().split(/\s{2,}/).pop()?.trim();
}
