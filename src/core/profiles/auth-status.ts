import { execa } from 'execa';
import { resolveAppPaths, type AppPaths } from '../../config/paths';
import { redactText } from '../../db/redact';
import { buildProfileEnv } from './env';

export interface DevinAuthStatus {
  loggedIn: boolean;
  email?: string;
  name?: string;
  userId?: string;
  tier?: string;
  plan?: string;
  teamId?: string;
  rawRedacted: string;
}

function field(output: string, label: string): string | undefined {
  const pattern = new RegExp(`^\\s*${label}:\\s*(.+)$`, 'im');
  return output.match(pattern)?.[1]?.trim();
}

export function parseAuthStatus(output: string): DevinAuthStatus {
  const rawRedacted = redactText(output);
  const notLoggedIn = /not logged in/i.test(output);

  return {
    loggedIn: !notLoggedIn && /logged in/i.test(output),
    email: field(output, 'Email'),
    name: field(output, 'Name'),
    userId: field(output, 'User ID'),
    tier: field(output, 'Tier'),
    plan: field(output, 'Plan'),
    teamId: field(output, 'Team ID'),
    rawRedacted
  };
}

export async function readAuthStatus(
  profileId: string,
  appPaths: AppPaths = resolveAppPaths()
): Promise<DevinAuthStatus> {
  const result = await execa('devin', ['auth', 'status'], {
    env: buildProfileEnv(profileId, appPaths),
    reject: false
  });
  return parseAuthStatus(`${result.stdout}\n${result.stderr}`);
}
