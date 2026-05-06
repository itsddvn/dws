import os from 'node:os';
import path from 'node:path';

export interface AppPaths {
  dataHome: string;
  configHome: string;
  appDataDir: string;
  appConfigDir: string;
  storePath: string;
  profilesDir: string;
}

function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveAppPaths(env: NodeJS.ProcessEnv = process.env): AppPaths {
  const dataHome = expandHome(env.DSW_DATA_HOME ?? env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local', 'share'));
  const configHome = expandHome(env.DSW_CONFIG_HOME ?? env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'));
  const appDataDir = path.join(dataHome, 'devin-switcher');
  const appConfigDir = path.join(configHome, 'devin-switcher');

  return {
    dataHome,
    configHome,
    appDataDir,
    appConfigDir,
    storePath: path.join(appDataDir, 'accounts.json'),
    profilesDir: path.join(appDataDir, 'profiles')
  };
}
