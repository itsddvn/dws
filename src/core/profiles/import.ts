import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { ensureProfileDirs } from './paths';

export interface ImportCredentialOptions {
  sourcePath?: string;
  force?: boolean;
  appPaths?: AppPaths;
}

export interface ImportCredentialResult {
  sourcePath: string;
  targetPath: string;
  sourceSha256: string;
  targetSha256: string;
}

export function defaultGlobalCredentialPath(): string {
  return path.join(os.homedir(), '.local', 'share', 'devin', 'credentials.toml');
}

export function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function importCredential(profileId: string, options: ImportCredentialOptions = {}): ImportCredentialResult {
  const sourcePath = options.sourcePath ?? defaultGlobalCredentialPath();
  const appPaths = options.appPaths ?? resolveAppPaths();
  const profilePaths = ensureProfileDirs(profileId, appPaths);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Credential file not found: ${sourcePath}`);
  }
  if (fs.existsSync(profilePaths.credentialsPath) && !options.force) {
    const sourceSha256 = sha256File(sourcePath);
    const targetSha256 = sha256File(profilePaths.credentialsPath);
    if (sourceSha256 === targetSha256) {
      return {
        sourcePath,
        targetPath: profilePaths.credentialsPath,
        sourceSha256,
        targetSha256
      };
    }
    throw new Error(`Target credential already exists: ${profilePaths.credentialsPath}`);
  }

  fs.copyFileSync(sourcePath, profilePaths.credentialsPath);
  fs.chmodSync(profilePaths.credentialsPath, 0o600);

  return {
    sourcePath,
    targetPath: profilePaths.credentialsPath,
    sourceSha256: sha256File(sourcePath),
    targetSha256: sha256File(profilePaths.credentialsPath)
  };
}
