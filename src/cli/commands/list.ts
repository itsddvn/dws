import { AccountService } from '../../core/accounts/service';

export function runList(): void {
  const service = new AccountService();
  const accounts = service.list();
  if (accounts.length === 0) {
    console.log('No Devin profiles configured.');
    return;
  }

  console.log(['name', 'enabled', 'status', 'email', 'tier', 'plan'].join('\t'));
  for (const account of accounts) {
    console.log(
      [
        account.name,
        account.enabled ? 'yes' : 'no',
        account.status,
        account.email ?? '',
        account.tier ?? '',
        account.plan_name ?? ''
      ].join('\t')
    );
  }
}
