import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type AppPaths } from '../config/paths';
import { ensureProfileDirs, type ProfilePaths } from './profile-paths';

type JsonObject = Record<string, unknown>;

export function prepareProfileRuntime(
  profileId: string,
  appPaths: AppPaths,
  baseEnv: NodeJS.ProcessEnv
): ProfilePaths {
  const profilePaths = ensureProfileDirs(profileId, appPaths);
  linkSharedCliState(profilePaths, baseEnv);
  syncSharedConfigToProfile(profilePaths, baseEnv);
  return profilePaths;
}

export function persistProfileRuntime(profileId: string, appPaths: AppPaths, baseEnv: NodeJS.ProcessEnv): void {
  const profilePaths = ensureProfileDirs(profileId, appPaths);
  syncProfileConfigToShared(profilePaths, baseEnv);
}

function linkSharedCliState(profilePaths: ProfilePaths, baseEnv: NodeJS.ProcessEnv): void {
  const sharedCliDir = path.join(resolveUserDataHome(baseEnv), 'devin', 'cli');
  const profileCliDir = path.join(profilePaths.devinDataDir, 'cli');
  if (path.resolve(sharedCliDir) === path.resolve(profileCliDir)) return;

  fs.mkdirSync(sharedCliDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(profileCliDir), { recursive: true, mode: 0o700 });

  const stat = fs.lstatSync(profileCliDir, { throwIfNoEntry: false });
  if (!stat) {
    fs.symlinkSync(sharedCliDir, profileCliDir, 'dir');
    return;
  }

  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory() && fs.readdirSync(profileCliDir).length === 0) {
    fs.rmdirSync(profileCliDir);
    fs.symlinkSync(sharedCliDir, profileCliDir, 'dir');
    return;
  }

  if (stat.isDirectory()) {
    fs.cpSync(profileCliDir, sharedCliDir, { recursive: true, force: false, errorOnExist: false });
    fs.rmSync(profileCliDir, { recursive: true, force: true });
    fs.symlinkSync(sharedCliDir, profileCliDir, 'dir');
  }
}

function syncSharedConfigToProfile(profilePaths: ProfilePaths, baseEnv: NodeJS.ProcessEnv): void {
  const sharedConfigPath = sharedDevinConfigPath(baseEnv);
  const profileConfigPath = profileDevinConfigPath(profilePaths);
  const sharedConfig = readJsonObject(sharedConfigPath);
  if (!sharedConfig) return;

  const profileConfig = readJsonObject(profileConfigPath) ?? {};
  const profileOrgId = readOrgId(profileConfig);
  const merged = mergeJsonObjects(profileConfig, sharedConfig);
  if (profileOrgId) setOrgId(merged, profileOrgId);

  writeJsonObject(profileConfigPath, merged);
}

function syncProfileConfigToShared(profilePaths: ProfilePaths, baseEnv: NodeJS.ProcessEnv): void {
  const profileConfigPath = profileDevinConfigPath(profilePaths);
  const profileConfig = readJsonObject(profileConfigPath);
  if (!profileConfig) return;

  const sharedConfigPath = sharedDevinConfigPath(baseEnv);
  const sharedConfig = readJsonObject(sharedConfigPath) ?? {};
  const sharedOrgId = readOrgId(sharedConfig);
  const profileWithoutOrg = structuredClone(profileConfig);
  removeOrgId(profileWithoutOrg);
  const merged = mergeJsonObjects(sharedConfig, profileWithoutOrg);
  if (sharedOrgId) setOrgId(merged, sharedOrgId);

  writeJsonObject(sharedConfigPath, merged);
}

function resolveUserDataHome(env: NodeJS.ProcessEnv): string {
  return path.resolve(env.XDG_DATA_HOME ?? path.join(env.HOME ?? os.homedir(), '.local', 'share'));
}

function resolveUserConfigHome(env: NodeJS.ProcessEnv): string {
  return path.resolve(env.XDG_CONFIG_HOME ?? path.join(env.HOME ?? os.homedir(), '.config'));
}

function sharedDevinConfigPath(env: NodeJS.ProcessEnv): string {
  return path.join(resolveUserConfigHome(env), 'devin', 'config.json');
}

function profileDevinConfigPath(profilePaths: ProfilePaths): string {
  return path.join(profilePaths.devinConfigDir, 'config.json');
}

function readJsonObject(filePath: string): JsonObject | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJsonObject(filePath: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function mergeJsonObjects(base: JsonObject, override: JsonObject): JsonObject {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] = isJsonObject(current) && isJsonObject(value) ? mergeJsonObjects(current, value) : structuredClone(value);
  }
  return result;
}

function readOrgId(config: JsonObject): string | null {
  const devin = config.devin;
  if (!isJsonObject(devin)) return null;
  return typeof devin.org_id === 'string' ? devin.org_id : null;
}

function setOrgId(config: JsonObject, orgId: string): void {
  const devin = isJsonObject(config.devin) ? config.devin : {};
  devin.org_id = orgId;
  config.devin = devin;
}

function removeOrgId(config: JsonObject): void {
  const devin = config.devin;
  if (!isJsonObject(devin)) return;
  delete devin.org_id;
  if (Object.keys(devin).length === 0) delete config.devin;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
