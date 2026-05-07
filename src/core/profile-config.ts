import fs from 'node:fs';
import path from 'node:path';
import { resolveAppPaths, type AppPaths } from '../config/paths';
import { resolveProfilePaths } from './profile-paths';

interface DevinUserConfig {
  devin?: { org_id?: string };
}

/**
 * Read the per-profile Devin user config to pick up the org id that
 * `devin auth login` / `devin setup` writes there. Returns `null` if the
 * file does not exist or has no `devin.org_id` entry.
 */
export function readProfileOrgId(profileId: string, appPaths: AppPaths = resolveAppPaths()): string | null {
  const profilePaths = resolveProfilePaths(profileId, appPaths);
  const configFile = path.join(profilePaths.devinConfigDir, 'config.json');
  if (!fs.existsSync(configFile)) return null;
  try {
    const raw = fs.readFileSync(configFile, 'utf8');
    const parsed = JSON.parse(raw) as DevinUserConfig;
    return parsed.devin?.org_id ?? null;
  } catch {
    return null;
  }
}
