import { AccountService } from '../../core/accounts/service';

export function runSetEnabled(name: string, enabled: boolean): void {
  const service = new AccountService();
  service.setEnabled(name, enabled);
  console.log(`${enabled ? 'Enabled' : 'Disabled'} profile ${name}`);
}
