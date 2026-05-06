import { AccountService } from '../../core/accounts/service';
import { readAuthStatus } from '../../core/profiles/auth-status';
import { runProfileLogin } from '../../core/profiles/login';

export async function runAdd(name: string): Promise<void> {
  const service = new AccountService();
  const account = service.create(name);
  await runProfileLogin(account.id);
  const status = await readAuthStatus(account.id);
  if (status.loggedIn) {
    service.updateAuthMetadata(account.id, {
      email: status.email,
      tier: status.tier,
      plan: status.plan,
      teamId: status.teamId
    });
  } else {
    service.markNeedsLogin(account.id, 'login did not produce authenticated status');
  }
  console.log(`Added profile ${name}`);
}
