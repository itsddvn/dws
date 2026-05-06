#!/usr/bin/env tsx
// A tiny stub of the `devin` CLI used by tests. It supports just enough of the
// surface that devin-switcher exercises:
//   devin --version
//   devin auth login         (writes a fake credential file under XDG_DATA_HOME)
//   devin auth status        (prints "logged in" if the credential file exists)
//   devin -p /usage          (prints a deterministic usage table)
//   devin <anything else>    (echoes args + env summary)
//
// Behavior can be tweaked via env vars:
//   DSW_FAKE_FAIL_LOGIN=1    -> auth login exits 1
//   DSW_FAKE_NEEDS_LOGIN=1   -> auth status / /usage report not logged in
//   DSW_FAKE_DAILY_PCT=42    -> override the daily remaining percentage
//   DSW_FAKE_WEEKLY_PCT=70   -> override the weekly remaining percentage
//   DSW_FAKE_EMAIL=foo@bar   -> override the email used by auth status

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function credentialPath(): string {
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(process.env.HOME ?? '/tmp', '.local', 'share');
  return path.join(dataHome, 'devin', 'credentials.toml');
}

function isLoggedIn(): boolean {
  if (process.env.DSW_FAKE_NEEDS_LOGIN === '1') return false;
  return fs.existsSync(credentialPath());
}

function authLogin(): number {
  if (process.env.DSW_FAKE_FAIL_LOGIN === '1') {
    console.error('fake-devin: simulated login failure');
    return 1;
  }
  const file = credentialPath();
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `# fake credential\nlogged_in_at = "${new Date().toISOString()}"\n`, { mode: 0o600 });
  console.log('Logged in successfully.');
  return 0;
}

function authStatus(): number {
  if (!isLoggedIn()) {
    console.log('Not logged in.');
    return 0;
  }
  console.log('Logged in.');
  console.log(`Email: ${process.env.DSW_FAKE_EMAIL ?? 'fake@example.com'}`);
  console.log('Tier: pro');
  console.log('Plan: Pro Monthly');
  return 0;
}

function usage(): number {
  if (!isLoggedIn()) {
    console.log('Not logged in. Please log in first.');
    return 1;
  }
  const daily = process.env.DSW_FAKE_DAILY_PCT ?? '60';
  const weekly = process.env.DSW_FAKE_WEEKLY_PCT ?? '80';
  console.log('Usage report:');
  console.log(`  Daily quota: ${daily}% remaining`);
  console.log(`  Weekly quota: ${weekly}% remaining`);
  console.log('  Prompt credits used: 100/500');
  console.log('  Flow credits used: 20/200');
  console.log('  Flex credits used: 5/50');
  return 0;
}

function main(): number {
  if (args[0] === '--version') {
    console.log('devin 0.0.0-fake');
    return 0;
  }
  if (args[0] === 'auth' && args[1] === 'login') return authLogin();
  if (args[0] === 'auth' && args[1] === 'status') return authStatus();
  if (args[0] === '-p' && args[1] === '/usage') return usage();
  console.log(`fake-devin invoked with: ${JSON.stringify(args)}`);
  console.log(`XDG_DATA_HOME=${process.env.XDG_DATA_HOME ?? ''}`);
  return 0;
}

process.exit(main());
