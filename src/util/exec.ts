import { spawn, type SpawnOptions } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeoutMs?: number;
}

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
    let timer: NodeJS.Timeout | null = null;

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code, signal });
    });
  });
}
