import fs from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { AccountService } from '../../core/accounts/service';
import { defaultGlobalCredentialPath } from '../../core/profiles/import';
import { runImportGlobal } from './import-global';

export async function runWizard(): Promise<void> {
  const service = new AccountService();
  if (service.list().length > 0) {
    console.log('Devin Switcher is already configured.');
    return;
  }

  const globalPath = defaultGlobalCredentialPath();
  if (!fs.existsSync(globalPath)) {
    console.log('No Devin profiles configured.');
    console.log('Run `dsw add <name>` to create a profile and login.');
    return;
  }

  const rl = createInterface({ input, output });
  try {
    const shouldImport = (await rl.question('Import current Devin login as Profile #1? [Y/n] ')).trim().toLowerCase();
    if (shouldImport === 'n' || shouldImport === 'no') {
      console.log('Skipped import. Run `dsw add <name>` when ready.');
      return;
    }

    const nameAnswer = (await rl.question('Profile name [primary]: ')).trim();
    const name = nameAnswer || 'primary';
    await runImportGlobal(name, {});
  } finally {
    rl.close();
  }
}
