import { runCapture } from '../util/exec';
import { buildProfileEnv } from './profile-env';
import type { Account } from './store';
import { resolveAppPaths, type AppPaths } from '../config/paths';

export async function getLatestSessionId(
  account: Account,
  options: { appPaths?: AppPaths; baseEnv?: NodeJS.ProcessEnv; output?: string } = {}
): Promise<string | null> {
  const fromOutput = parseSessionId(options.output ?? '');
  if (fromOutput) return fromOutput;

  const appPaths = options.appPaths ?? resolveAppPaths();
  const baseEnv = options.baseEnv ?? process.env;
  try {
    const result = await runCapture('devin', ['list', '--format', 'json'], {
      env: buildProfileEnv(account.id, appPaths, baseEnv),
      timeoutMs: 10_000
    });
    if (result.exitCode !== 0) return null;
    return parseSessionList(result.stdout);
  } catch {
    return null;
  }
}

export function parseSessionId(output: string): string | null {
  return output.match(/Session ID:\s*([A-Za-z0-9._:-]+)/i)?.[1] ?? null;
}

function parseSessionList(output: string): string | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    const sessions = Array.isArray(parsed) ? parsed : [];
    const first = sessions.find((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    const id = first?.id ?? first?.sessionId ?? first?.session_id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}
