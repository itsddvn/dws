import { resolveAppPaths } from '../../config/paths';
import { openAppDatabase } from '../../db/client';
import { seedDefaultSettings } from '../../config/settings';
import { ensureUiToken } from '../../server';

export function runDoctor(): void {
  const paths = resolveAppPaths();
  const db = openAppDatabase();
  seedDefaultSettings(db);
  db.close();
  ensureUiToken(paths.uiTokenPath);

  console.log('devin-switcher doctor');
  console.log(`data: ${paths.appDataDir}`);
  console.log(`config: ${paths.appConfigDir}`);
  console.log(`db: ${paths.dbPath}`);
  console.log(`profiles: ${paths.profilesDir}`);
  console.log('ok');
}
