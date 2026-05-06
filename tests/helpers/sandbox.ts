import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../../src/config/paths';

export interface Sandbox {
  root: string;
  dataHome: string;
  configHome: string;
  paths: AppPaths;
  cleanup: () => void;
  env: NodeJS.ProcessEnv;
}

export function createSandbox(): Sandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-test-'));
  const dataHome = path.join(root, 'data');
  const configHome = path.join(root, 'config');
  fs.mkdirSync(dataHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(configHome, { recursive: true, mode: 0o700 });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: root,
    DSW_DATA_HOME: dataHome,
    DSW_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_CONFIG_HOME: configHome
  };
  const paths = resolveAppPaths(env);
  return {
    root,
    dataHome,
    configHome,
    paths,
    env,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

export function fakeDevinPath(): string {
  return path.join(__dirname, '..', '..', 'scripts', 'fake-devin.ts');
}
