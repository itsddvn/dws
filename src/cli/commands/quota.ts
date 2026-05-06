import { spawn } from 'node:child_process';
import { readProfileOrgId, usageUrlForOrg } from '../../core/profile-config';
import { AccountStore } from '../../core/store';
import { renderTable } from '../../util/format';

export interface QuotaCommandOptions {
  name?: string;
  open?: boolean;
}

/**
 * The Devin CLI does not expose quota numbers, and the Devin webapp loads
 * them via authenticated browser-session-only API calls. So `dsw quota`
 * just shows the per-account usage URL the user can click to view in their
 * browser. With `--open`, it launches the URL via the system opener.
 */
export async function runQuota(options: QuotaCommandOptions = {}): Promise<void> {
  const store = new AccountStore();
  const allAccounts = store.list();
  if (allAccounts.length === 0) {
    console.log('No Devin accounts configured. Run `dsw add <name>` to add one.');
    return;
  }

  const accounts = options.name ? [store.getByName(options.name)] : allAccounts;

  // Refresh org id from each profile's devin config.json in case `devin auth login`
  // / `devin setup` saved/updated it after the account was created.
  for (const account of accounts) {
    const orgId = readProfileOrgId(account.id);
    if (orgId && orgId !== account.orgId) {
      store.update(account.id, (a) => ({ ...a, orgId }));
    }
  }

  const refreshed = options.name ? [store.getByName(options.name)] : store.list();
  const rows = refreshed.map((account) => [
    account.name,
    account.email ?? '',
    account.orgId ?? '(unknown)',
    usageUrlForOrg(account.orgId)
  ]);
  console.log(renderTable(['name', 'email', 'org id', 'usage url'], rows));

  if (options.open) {
    for (const account of refreshed) {
      const url = usageUrlForOrg(account.orgId);
      openUrl(url);
      console.error(`Opened ${url}`);
    }
  } else {
    console.log('');
    console.log('Note: Devin does not expose quota via the CLI. Open the URL above to view it.');
    console.log('      Use `dsw quota --open` to launch it in your browser.');
  }
}

function openUrl(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const args = process.platform === 'win32' ? ['', url] : [url];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}
