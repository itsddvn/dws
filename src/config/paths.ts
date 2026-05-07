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

function resolveUserPath(input: string): string {
  const expanded = expandHome(input);
  return path.resolve(expanded);
}

export function resolveAppPaths(env: NodeJS.ProcessEnv = process.env): AppPaths {
  const dataHome = resolveUserPath(env.DSW_DATA_HOME ?? path.join(os.homedir(), '.dsw'));
  const configHome = resolveUserPath(env.DSW_CONFIG_HOME ?? dataHome);
  const appDataDir = dataHome;
  const appConfigDir = configHome;

  return {
    dataHome,
    configHome,
    appDataDir,
    appConfigDir,
    storePath: path.join(appDataDir, 'accounts.json'),
    profilesDir: path.join(appDataDir, 'profiles')
  };
}
