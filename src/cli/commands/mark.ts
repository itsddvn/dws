import { AccountService } from '../../core/accounts/service';

export function runMarkLimited(name: string, options: { until?: string; untilReset?: boolean }): void {
  let until: number | null | undefined;
  if (options.until) {
    const parsed = Date.parse(options.until);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid --until value: ${options.until}`);
    }
    until = Math.floor(parsed / 1000);
  }
  if (options.untilReset) {
    until = null;
  }
  const service = new AccountService();
  service.markLimited(name, 'manual', until);
  console.log(`Marked profile ${name} limited`);
}

export function runUnmark(name: string): void {
  const service = new AccountService();
  service.unmark(name);
  console.log(`Unmarked profile ${name}`);
}
