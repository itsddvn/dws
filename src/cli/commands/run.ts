import { AccountService } from '../../core/accounts/service';
import { runDevinWithAccount } from '../../core/runner/lifecycle';
import { openAppDatabase } from '../../db/client';
import { selectNextAccount, type SelectionStrategy } from '../../core/scheduler/strategies';

export async function runExplicitProfile(name: string, args: string[]): Promise<void> {
  const service = new AccountService();
  const account = service.getByName(name);
  const exitCode = await runDevinWithAccount({ account, args, strategy: 'manual' });
  process.exitCode = exitCode ?? 1;
}

export async function runNextProfile(strategy: SelectionStrategy, args: string[]): Promise<void> {
  const db = openAppDatabase();
  const account = selectNextAccount(db, strategy);
  db.close();
  const exitCode = await runDevinWithAccount({ account, args, strategy });
  process.exitCode = exitCode ?? 1;
}
