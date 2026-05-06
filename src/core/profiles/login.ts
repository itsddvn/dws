import { spawn } from 'node:child_process';
import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { buildProfileEnv } from './env';

export interface LoginOptions {
  appPaths?: AppPaths;
  timeoutMs?: number;
}

export function runProfileLogin(profileId: string, options: LoginOptions = {}): Promise<void> {
  const appPaths = options.appPaths ?? resolveAppPaths();
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const child = spawn('devin', ['auth', 'login'], {
      env: buildProfileEnv(profileId, appPaths),
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
