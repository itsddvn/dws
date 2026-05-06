import fs from 'node:fs';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../../config/paths';

export interface ProfilePaths {
  rootDir: string;
  dataHome: string;
  configHome: string;
  devinDataDir: string;
  devinConfigDir: string;
  credentialsPath: string;
}

export function resolveProfilePaths(profileId: string, appPaths: AppPaths = resolveAppPaths()): ProfilePaths {
  if (!profileId.trim()) {
    throw new Error('profileId is required');
  }

  const rootDir = path.join(appPaths.profilesDir, profileId);
  const dataHome = path.join(rootDir, 'data');
  const configHome = path.join(rootDir, 'config');
  const devinDataDir = path.join(dataHome, 'devin');
  const devinConfigDir = path.join(configHome, 'devin');

  return {
    rootDir,
    dataHome,
    configHome,
    devinDataDir,
    devinConfigDir,
    credentialsPath: path.join(devinDataDir, 'credentials.toml')
  };
}

export function ensureProfileDirs(profileId: string, appPaths: AppPaths = resolveAppPaths()): ProfilePaths {
  const profilePaths = resolveProfilePaths(profileId, appPaths);
  fs.mkdirSync(profilePaths.rootDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profilePaths.dataHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profilePaths.configHome, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profilePaths.devinDataDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profilePaths.devinConfigDir, { recursive: true, mode: 0o700 });
  return profilePaths;
}
