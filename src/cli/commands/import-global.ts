import { AccountService } from '../../core/accounts/service';
import { importCredential } from '../../core/profiles/import';
import { readAuthStatus } from '../../core/profiles/auth-status';

export async function runImportGlobal(name: string, options: { force?: boolean }): Promise<void> {
  const service = new AccountService();
  const account = service.create(name);
  const result = importCredential(account.id, { force: options.force });
  const status = await readAuthStatus(account.id);
  if (status.loggedIn) {
    service.updateAuthMetadata(account.id, {
      email: status.email,
      tier: status.tier,
      plan: status.plan,
      teamId: status.teamId
    });
  } else {
    service.markNeedsLogin(account.id, 'imported credential is not logged in');
  }

  console.log(`Imported global credential into profile ${name}`);
  console.log(`source: ${result.sourcePath}`);
  console.log(`target: ${result.targetPath}`);
}
