import { runWithQuotaPick } from './_shared';

export interface DefaultCommandOptions {
  args: string[];
}

export async function runDefault(options: DefaultCommandOptions): Promise<void> {
  await runWithQuotaPick({ args: options.args });
}
