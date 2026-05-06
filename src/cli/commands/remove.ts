import { AccountService } from '../../core/accounts/service';

export function runRemove(name: string, options: { yes?: boolean }): void {
  if (!options.yes) {
    throw new Error('Refusing to remove without --yes');
  }
  const service = new AccountService();
  service.remove(name);
  console.log(`Removed profile ${name}`);
}
