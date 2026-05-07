export interface PtyProcess {
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    }
  ): PtyProcess;
}

export interface PtyLoadResult {
  ok: boolean;
  pty?: PtyModule;
  reason?: string;
}

let cached: Promise<PtyLoadResult> | null = null;

export async function loadPty(): Promise<PtyLoadResult> {
  cached ??= loadAndSmoke();
  return await cached;
}

export function resetPtyLoaderForTests(): void {
  cached = null;
}

async function loadAndSmoke(): Promise<PtyLoadResult> {
  let pty: PtyModule;
  try {
    pty = (await import('node-pty')) as PtyModule;
  } catch (error) {
    return { ok: false, reason: `node-pty import failed: ${messageFor(error)}` };
  }

  try {
    await smokeSpawn(pty);
    return { ok: true, pty };
  } catch (error) {
    return { ok: false, reason: `node-pty spawn failed: ${messageFor(error)}` };
  }
}

function smokeSpawn(pty: PtyModule): Promise<void> {
  return new Promise((resolve, reject) => {
    const term = pty.spawn(process.execPath, ['-e', 'process.exit(0)'], {
      name: 'xterm-256color',
      cols: 2,
      rows: 2,
      cwd: process.cwd(),
      env: process.env
    });
    const timer = setTimeout(() => {
      try {
        term.kill();
      } catch {
        // Best effort cleanup.
      }
      reject(new Error('smoke spawn timed out'));
    }, 2_000);
    term.onExit(({ exitCode }) => {
      clearTimeout(timer);
      if (exitCode === 0) resolve();
      else reject(new Error(`smoke spawn exited ${exitCode}`));
    });
  });
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
