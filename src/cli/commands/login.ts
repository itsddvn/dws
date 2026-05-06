import { AccountService } from '../../core/accounts/service';
import { readAuthStatus } from '../../core/profiles/auth-status';
import { runProfileLogin } from '../../core/profiles/login';

export async function runLogin(name: string): Promise<void> {
  const service = new AccountService();
  const account = service.getByName(name);
  await runProfileLogin(account.id);
  const status = await readAuthStatus(account.id);
  if (status.loggedIn) {
    service.updateAuthMetadata(account.id, {
      email: status.email,
      tier: status.tier,
      plan: status.plan,
      teamId: status.teamId
    });
    console.log(`Profile ${name} is logged in`);
    return;
  }
  service.markNeedsLogin(account.id, 'auth status still reports not logged in');
  console.log(`Profile ${name} still needs login`);
}
