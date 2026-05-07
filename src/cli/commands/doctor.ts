import fs from 'node:fs';
import { resolveAppPaths } from '../../config/paths';
import { getPtyAvailability } from '../../core/pty-runner';
import { AccountStore } from '../../core/store';
import { runCapture } from '../../util/exec';

export async function runDoctor(): Promise<void> {
  const paths = resolveAppPaths();
  console.log('devin-switcher doctor');
  console.log(`  data dir: ${paths.appDataDir}${dirExists(paths.appDataDir) ? '' : ' (missing)'}`);
  console.log(`  config dir: ${paths.appConfigDir}${dirExists(paths.appConfigDir) ? '' : ' (missing)'}`);
  console.log(`  store: ${paths.storePath}${fs.existsSync(paths.storePath) ? '' : ' (missing)'}`);
  console.log(`  profiles: ${paths.profilesDir}${dirExists(paths.profilesDir) ? '' : ' (missing)'}`);

  let devinVersion: string | null = null;
  try {
    const result = await runCapture('devin', ['--version'], { timeoutMs: 10_000 });
    if (result.exitCode === 0) devinVersion = result.stdout.trim().split('\n')[0] ?? null;
  } catch (error) {
    devinVersion = `error: ${error instanceof Error ? error.message : String(error)}`;
  }
  console.log(`  devin: ${devinVersion ?? 'not found'}`);

  const pty = await getPtyAvailability();
  console.log(`  node-pty: ${pty.available ? 'available' : `unavailable (${pty.reason ?? 'unknown'})`}`);

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
  if (!pty.available) {
    console.error('warning: node-pty is unavailable. `dsw quota` and auto-rotate require node-pty.');
    process.exitCode = 1;
  }
}

function dirExists(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}
