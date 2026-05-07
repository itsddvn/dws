import { Command } from 'commander';
import { runAdd } from './commands/add';
import { runDefault } from './commands/default';
import { runDoctor } from './commands/doctor';
import { runList } from './commands/list';
import { runLogin } from './commands/login';
import { runNext } from './commands/next';
import { runRemove } from './commands/remove';
import { runUpdate } from './commands/update';

const SUBCOMMANDS = new Set([
  'list',
  'ls',
  'add',
  'remove',
  'rm',
  'login',
  'next',
  'update',
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
    await runDefault({ args });
    return;
  }

  const program = new Command();
  program
    .name('dsw')
    .description('Devin CLI account switcher: rotate between accounts and run devin under each.')
    .version('0.3.0');

  program.addHelpText(
    'after',
    `\nExamples:\n  $ dsw                 Pick the least-recently-used account and run devin\n  $ dsw next            Pick the next account in list order and run devin\n  $ dsw -p "fix bug"    Forward args to devin (anything not a subcommand is passed through)\n  $ dsw list            Show all accounts\n  $ dsw add             Create a profile and infer its account name after login\n  $ dsw add work        Create the 'work' profile and run devin auth login\n  $ dsw login work      Re-run devin auth login for 'work'\n  $ dsw remove work --yes\n  $ dsw update          Update this dsw install\n`
  );

  program
    .command('list')
    .alias('ls')
    .description('List configured Devin accounts')
    .action(() => {
      runList();
    });

  program
    .command('add')
    .description('Add a new Devin account and run `devin auth login` for it')
    .argument('[name]', 'Account name (letters, numbers, _, -). If omitted, inferred after login.')
    .action(async (name: string | undefined) => {
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
    .command('next')
    .description('Run devin using the next ready account in configured list order')
    .allowUnknownOption(true)
    .argument('[args...]', 'Arguments to forward to devin')
    .action(async (args: string[]) => {
      await runNext({ args });
    });

  program
    .command('update')
    .description('Update this dsw install')
    .option('--dry-run', 'Print update commands without running them')
    .action(async (options: { dryRun?: boolean }) => {
      await runUpdate({ dryRun: options.dryRun });
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
