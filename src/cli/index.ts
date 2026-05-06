import { Command } from 'commander';
import { runAdd } from './commands/add';
import { runDefault } from './commands/default';
import { runDoctor } from './commands/doctor';
import { runList } from './commands/list';
import { runLogin } from './commands/login';
import { runQuota } from './commands/quota';
import { runRemove } from './commands/remove';

const SUBCOMMANDS = new Set([
  'list',
  'ls',
  'quota',
  'add',
  'remove',
  'rm',
  'login',
  'doctor',
  'help',
  '--help',
  '-h',
  '--version',
  '-V'
]);

export async function main(argv = process.argv): Promise<void> {
  const args = argv.slice(2);
  const first = args[0];

  if (!first || !SUBCOMMANDS.has(first)) {
    let forwarded = args;
    let skipRefresh = false;
    while (forwarded.length && (forwarded[0] === '--no-refresh' || forwarded[0] === '--refresh')) {
      if (forwarded[0] === '--no-refresh') skipRefresh = true;
      forwarded = forwarded.slice(1);
    }
    await runDefault({ args: forwarded, skipRefresh });
    return;
  }

  const program = new Command();
  program
    .name('dsw')
    .description('Devin CLI account switcher: pick the account with the most quota and run devin under it.')
    .version('0.2.0');

  program.addHelpText(
    'after',
    `\nExamples:\n  $ dsw                 Refresh quota and run devin with the best account\n  $ dsw -p "fix bug"    Forward args to devin (anything not a subcommand is passed through)\n  $ dsw list            Show all accounts\n  $ dsw quota           Refresh quota for all accounts\n  $ dsw add work        Create the 'work' profile and run devin auth login\n  $ dsw login work      Re-run devin auth login for 'work'\n  $ dsw remove work --yes\n`
  );

  program
    .command('list')
    .alias('ls')
    .description('List configured Devin accounts')
    .action(() => {
      runList();
    });

  program
    .command('quota')
    .description('Refresh quota for all accounts (or a single account)')
    .argument('[name]', 'Optional account name')
    .option('--raw', 'Print the raw redacted /usage output')
    .action(async (name: string | undefined, options: { raw?: boolean }) => {
      await runQuota({ name, raw: options.raw });
    });

  program
    .command('add')
    .description('Add a new Devin account and run `devin auth login` for it')
    .argument('<name>', 'Account name (letters, numbers, _, -)')
    .action(async (name: string) => {
      await runAdd(name);
    });

  program
    .command('remove')
    .alias('rm')
    .description('Remove an account and delete its profile credentials')
    .argument('<name>', 'Account name')
    .option('--yes', 'Confirm removal (required)')
    .action((name: string, options: { yes?: boolean }) => {
      runRemove(name, options);
    });

  program
    .command('login')
    .description('Re-run `devin auth login` for an existing account')
    .argument('<name>', 'Account name')
    .action(async (name: string) => {
      await runLogin(name);
    });

  program
    .command('doctor')
    .description('Print local paths and verify devin CLI is available')
    .action(async () => {
      await runDoctor();
    });

  await program.parseAsync(argv);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`dsw: ${message}`);
    process.exitCode = 1;
  });
}
