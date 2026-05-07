import { runWithQuotaPick } from './_shared';

export interface NextCommandOptions {
  args: string[];
}

export async function runNext(options: NextCommandOptions): Promise<void> {
  await runWithQuotaPick({ args: options.args });
}
