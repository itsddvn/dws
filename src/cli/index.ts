import { Command } from 'commander';
import { runAdd } from './commands/add';
import { runDoctor } from './commands/doctor';
import { runSetEnabled } from './commands/enable-disable';
import { runImportGlobal } from './commands/import-global';
import { runList } from './commands/list';
import { runLogin } from './commands/login';
import { runMarkLimited, runUnmark } from './commands/mark';
import { runRemove } from './commands/remove';
import { runExplicitProfile, runNextProfile } from './commands/run';
import { runUi } from './commands/ui';
import { runWizard } from './commands/wizard';

export async function main(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('dsw')
    .description('Local Devin CLI profile switcher')
    .version('0.1.0')
    .action(async () => {
      await runWizard();
    });

  program
    .command('run')
    .description('Run devin under an explicit profile')
    .argument('<name>', 'Profile name')
    .argument('[args...]', 'Arguments passed to devin')
    .allowUnknownOption(true)
    .action(async (name: string, args: string[]) => {
      await runExplicitProfile(name, args);
    });

  program
    .command('next')
    .description('Select an eligible profile and run devin')
    .option('--strategy <strategy>', 'quota-weighted, round-robin, or manual', 'quota-weighted')
    .argument('[args...]', 'Arguments passed to devin')
    .allowUnknownOption(true)
    .action(async (args: string[], options: { strategy: string }) => {
      const strategy = normalizeStrategy(options.strategy);
      await runNextProfile(strategy, args);
    });

  program
    .command('mark-limited')
    .description('Manually mark a profile limited')
    .argument('<name>', 'Profile name')
    .option('--until <iso>', 'Limit until this ISO timestamp')
    .option('--until-reset', 'Limit until server reset/manual unmark')
    .action((name: string, options: { until?: string; untilReset?: boolean }) => {
      runMarkLimited(name, options);
    });

  program
    .command('unmark')
    .description('Clear manual limited status for a profile')
    .argument('<name>', 'Profile name')
    .action((name: string) => {
      runUnmark(name);
    });

  program
    .command('add')
    .description('Create a profile and launch devin auth login inside it')
    .argument('<name>', 'Profile name')
    .action(async (name: string) => {
      await runAdd(name);
    });

  program
    .command('login')
    .description('Re-login an existing profile')
    .argument('<name>', 'Profile name')
    .action(async (name: string) => {
      await runLogin(name);
    });

  program
    .command('import-global')
    .description('Copy the current global Devin credential into a new profile')
    .argument('<name>', 'Profile name')
    .option('--force', 'Overwrite existing profile credential if present')
    .action(async (name: string, options: { force?: boolean }) => {
      await runImportGlobal(name, options);
    });

  program
    .command('list')
    .description('List configured Devin profiles')
    .action(() => {
      runList();
    });

  program
    .command('remove')
    .description('Remove a profile and its local files')
    .argument('<name>', 'Profile name')
    .option('--yes', 'Confirm removal')
    .action((name: string, options: { yes?: boolean }) => {
      runRemove(name, options);
    });

  program
    .command('enable')
    .description('Enable a profile')
    .argument('<name>', 'Profile name')
    .action((name: string) => {
      runSetEnabled(name, true);
    });

  program
    .command('disable')
    .description('Disable a profile')
    .argument('<name>', 'Profile name')
    .action((name: string) => {
      runSetEnabled(name, false);
    });

  program
    .command('wizard')
    .description('Run the first-run setup wizard')
    .action(async () => {
      await runWizard();
    });

  program
    .command('doctor')
    .description('Verify local paths, permissions, and database setup')
    .action(() => {
      runDoctor();
    });

  program
    .command('ui')
    .description('Start the local web UI')
    .option('--port <port>', 'Port to bind; 0 chooses a random port', '0')
    .action(async (options: { port?: string }) => {
      await runUi(options.port);
    });

  program
    .command('status')
    .description('Show account and selector status')
    .action(() => {
      console.log('status: not implemented yet');
    });

  await program.parseAsync(argv);
}

function normalizeStrategy(input: string): 'manual' | 'quota-weighted' | 'round-robin' {
  if (input === 'quota' || input === 'quota-weighted') {
    return 'quota-weighted';
  }
  if (input === 'rr' || input === 'round-robin') {
    return 'round-robin';
  }
  if (input === 'manual') {
    return 'manual';
  }
  throw new Error(`Unknown strategy: ${input}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`dsw: ${message}`);
  process.exitCode = 1;
});
