import { spawn, type SpawnOptions } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs?: number;
  /**
   * Grace period after SIGTERM before sending SIGKILL when the timeout
   * fires. Defaults to 2s. Set to 0 to send SIGKILL immediately.
   */
  killAfterMs?: number;
}

const DEFAULT_KILL_AFTER_MS = 2_000;

export function runCapture(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = {
      env: options.env ?? process.env,
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    };
    const child = spawn(command, args, spawnOptions);
    let stdout = '';
    let stderr = '';
    let softTimer: NodeJS.Timeout | null = null;
    let hardTimer: NodeJS.Timeout | null = null;
    let timedOut = false;

    const clearTimers = (): void => {
      if (softTimer) clearTimeout(softTimer);
      if (hardTimer) clearTimeout(hardTimer);
      softTimer = null;
      hardTimer = null;
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    if (options.timeoutMs && options.timeoutMs > 0) {
      softTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        const killAfter = options.killAfterMs ?? DEFAULT_KILL_AFTER_MS;
        if (killAfter <= 0) {
          child.kill('SIGKILL');
        } else {
          hardTimer = setTimeout(() => child.kill('SIGKILL'), killAfter);
        }
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      clearTimers();
      reject(error);
    });
    child.on('exit', (code, signal) => {
      clearTimers();
      resolve({ stdout, stderr, exitCode: code, signal, timedOut });
    });
  });
}
