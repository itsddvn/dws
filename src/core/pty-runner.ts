import fs from 'node:fs';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { buildProfileEnv } from './profile-env';
import { persistProfileRuntime } from './profile-runtime';
import { getLatestSessionId, parseSessionId } from './session-tracker';
import type { Account, AccountStore } from './store';
import { loadPty } from './pty-loader';
import { OutputWatcher } from './output-watcher';
import { InputInterceptor } from './input-interceptor';
import { PromptCapture } from './prompt-capture';
import { RotateEngine } from './rotate-engine';
import type { PtyModule } from './pty-loader';

export interface RunDevinPtyOptions {
  args: string[];
  appPaths?: AppPaths;
  baseEnv?: NodeJS.ProcessEnv;
  autoRotate: boolean;
  ptyModule?: PtyModule;
  rotateEngine?: Pick<RotateEngine, 'rotate'>;
}

export interface PtyAvailability {
  available: boolean;
  reason?: string;
}

export async function getPtyAvailability(baseEnv: NodeJS.ProcessEnv = process.env): Promise<PtyAvailability> {
  if (baseEnv.DSW_DISABLE_PTY === '1') return { available: false, reason: 'disabled by DSW_DISABLE_PTY=1' };
  const loaded = await loadPty();
  return loaded.ok && loaded.pty ? { available: true } : { available: false, reason: loaded.reason };
}

export async function runDevinPtyForAccount(
  store: AccountStore,
  account: Account,
  options: RunDevinPtyOptions
): Promise<number | null> {
  const loaded = options.ptyModule ? { ok: true, pty: options.ptyModule } : await loadPty();
  if (!loaded.ok || !loaded.pty) throw new Error(loaded.reason ?? 'node-pty unavailable');

  const appPaths = options.appPaths ?? resolveAppPaths();
  const baseEnv = options.baseEnv ?? process.env;
  let active = account;
  let output = '';
  let sessionId: string | null = null;
  const watcher = new OutputWatcher();
  const input = new InputInterceptor({
    onDebugChunk: makeStdinDebugger(baseEnv, appPaths)
  });
  const capture = new PromptCapture();
  const rotateEngine = options.rotateEngine ?? new RotateEngine(store, baseEnv);

  return await new Promise((resolve) => {
    let finished = false;
    let activeGeneration = 0;
    let term = spawn(active, options.args);

    const finish = (code: number | null): void => {
      if (finished) return;
      finished = true;
      cleanupTerminal();
      persistProfileRuntime(active.id, appPaths, baseEnv);
      resolve(code);
    };

    function spawn(spawnAccount: Account, args: string[]) {
      const generation = ++activeGeneration;
      const next = loaded.pty!.spawn('devin', args, {
        name: 'xterm-256color',
        cols: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 24,
        cwd: process.cwd(),
        env: buildProfileEnv(spawnAccount.id, appPaths, baseEnv)
      });
      store.touchLastUsed(spawnAccount.id);
      next.onData((chunk) => {
        output += chunk;
        sessionId ??= parseSessionId(output);
        process.stdout.write(chunk);
        const trigger = watcher.push(chunk);
        if (options.autoRotate && trigger) void rotate(trigger === 'recoverable-error');
      });
      next.onExit(({ exitCode }) => {
        if (generation === activeGeneration) finish(exitCode);
      });
      return next;
    }

    async function rotate(manual: boolean): Promise<void> {
      sessionId ??= await getLatestSessionId(active, { appPaths, baseEnv, output });
      const result = await rotateEngine.rotate({ current: active, manual, sessionId });
      if (!result.account || !sessionId) {
        process.stderr.write(`\ndsw: rotate skipped${result.reason ? `: ${result.reason}` : ''}.\n`);
        return;
      }
      const replay = capture.consumeReplayCandidate();
      process.stderr.write(`\ndsw: rotating from ${active.name} to ${result.account.name} and resuming ${sessionId}.\n`);
      const previous = term;
      active = result.account;
      term = spawn(active, ['-r', sessionId]);
      try {
        previous.kill();
      } catch {
        // The child may already be gone.
      }
      if (replay) term.write(`${replay}\r`);
      else process.stderr.write('dsw: no safe single-line prompt to replay; resend manually if needed.\n');
    }

    const onStdinData = (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      const result = input.push(text);
      if (result.localEcho) process.stdout.write(result.localEcho);
      if (result.passThrough) {
        if (!result.rotate) capture.push(result.passThrough);
        term.write(result.passThrough);
      }
      if (result.rotate) void rotate(true);
    };
    const onResize = (): void => term.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);

    process.stdin.on('data', onStdinData);
    process.stdout.on('resize', onResize);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    function cleanupTerminal(): void {
      process.stdin.off('data', onStdinData);
      process.stdout.off('resize', onResize);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    }
  });
}

function makeStdinDebugger(baseEnv: NodeJS.ProcessEnv, appPaths: AppPaths): ((data: string) => void) | undefined {
  if (baseEnv.DSW_DEBUG_STDIN !== '1') return undefined;
  fs.mkdirSync(appPaths.appDataDir, { recursive: true, mode: 0o700 });
  const file = path.join(appPaths.appDataDir, 'stdin-debug.log');
  if (!fs.existsSync(file)) fs.closeSync(fs.openSync(file, 'w', 0o600));
  fs.chmodSync(file, 0o600);
  return (data: string) => {
    const bytes = Buffer.from(data, 'utf8');
    fs.appendFileSync(file, `${JSON.stringify(data)} ${bytes.toString('hex')}\n`);
  };
}
