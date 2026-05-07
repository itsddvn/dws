import fs from 'node:fs';
import { resolveAppPaths } from '../../config/paths';
import { AccountStore } from '../../core/store';
import { runCapture } from '../../util/exec';

export async function runDoctor(): Promise<void> {
  const paths = resolveAppPaths();
  console.log('devin-switcher doctor');
  console.log(`  data dir: ${paths.appDataDir}`);
  console.log(`  config dir: ${paths.appConfigDir}`);
  console.log(`  store: ${paths.storePath}`);
  console.log(`  profiles: ${paths.profilesDir}`);

  fs.mkdirSync(paths.appDataDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(paths.profilesDir, { recursive: true, mode: 0o700 });

  let devinVersion: string | null = null;
  try {
    const result = await runCapture('devin', ['--version'], { timeoutMs: 10_000 });
    if (result.exitCode === 0) devinVersion = result.stdout.trim().split('\n')[0] ?? null;
  } catch (error) {
    devinVersion = `error: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(`  devin: ${devinVersion ?? 'not found'}`);

  let tmuxVersion: string | null = null;
  try {
    const result = await runCapture('tmux', ['-V'], { timeoutMs: 10_000 });
    if (result.exitCode === 0) tmuxVersion = result.stdout.trim().split('\n')[0] ?? null;
  } catch (error) {
    tmuxVersion = `error: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(`  tmux: ${tmuxVersion ?? 'not found'}`);

  const store = new AccountStore(paths);
  const accounts = store.list();
  console.log(`  accounts: ${accounts.length}`);
  for (const account of accounts) {
    const flag = account.needsLogin ? ' (needs login)' : '';
    console.log(`    - ${account.name}${flag}`);
  }

  if (!devinVersion || devinVersion.startsWith('error:')) {
    console.error('warning: devin CLI was not detected in PATH.');
    process.exitCode = 1;
  }
  if (!tmuxVersion || tmuxVersion.startsWith('error:')) {
    console.error('warning: tmux was not detected in PATH. `dsw quota` requires tmux.');
    process.exitCode = 1;
  }
}
