import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { ensureProfileDirs } from './paths';

export function buildProfileEnv(
  profileId: string,
  appPaths: AppPaths = resolveAppPaths(),
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const profilePaths = ensureProfileDirs(profileId, appPaths);
  return {
    ...baseEnv,
    XDG_DATA_HOME: profilePaths.dataHome,
    XDG_CONFIG_HOME: profilePaths.configHome
  };
}
