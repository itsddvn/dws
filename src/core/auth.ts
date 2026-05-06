import { spawn } from 'node:child_process';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { runCapture, type RunOptions } from '../util/exec';
import { redactText } from '../util/redact';
import { buildProfileEnv } from './profile-env';

export interface DevinAuthStatus {
  loggedIn: boolean;
  email?: string;
  name?: string;
  tier?: string;
  plan?: string;
  rawRedacted: string;
}

export interface LoginOptions {
  appPaths?: AppPaths;
  timeoutMs?: number;
  baseEnv?: NodeJS.ProcessEnv;
}

export interface AuthStatusOptions {
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
  runImpl?: typeof runCapture;
}

export function runDevinLogin(profileId: string, options: LoginOptions = {}): Promise<void> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const child = spawn('devin', ['auth', 'login'], {
      env: buildProfileEnv(profileId, appPaths, options.baseEnv ?? process.env),
      stdio: 'inherit'
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('devin auth login timed out'));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`devin auth login failed with ${signal ?? code}`));
    });
  });
}

export async function readAuthStatus(profileId: string, options: AuthStatusOptions = {}): Promise<DevinAuthStatus> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const runImpl = options.runImpl ?? runCapture;
  const runOptions: RunOptions = {
    env: buildProfileEnv(profileId, appPaths, options.baseEnv ?? process.env),
    timeoutMs: 60_000
  };
  const result = await runImpl('devin', ['auth', 'status'], runOptions);
  return parseAuthStatus(`${result.stdout}\n${result.stderr}`);
}

export function parseAuthStatus(output: string): DevinAuthStatus {
  const rawRedacted = redactText(output);
  const notLoggedIn = /not logged in/i.test(output);
  return {
    loggedIn: !notLoggedIn && /logged in/i.test(output),
    email: field(output, 'Email'),
    name: field(output, 'Name'),
    tier: field(output, 'Tier'),
    plan: field(output, 'Plan'),
    rawRedacted
  };
}

function field(output: string, label: string): string | undefined {
  const pattern = new RegExp(`^\\s*${label}:\\s*(.+)$`, 'im');
  return output.match(pattern)?.[1]?.trim();
}
