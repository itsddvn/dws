#!/usr/bin/env tsx
// A tiny stub of the `devin` CLI used by tests. It supports just enough of the
// surface that devin-switcher exercises:
//   devin --version
//   devin auth login         (writes a fake credential file under XDG_DATA_HOME)
//   devin auth status        (prints "logged in" if the credential file exists)
//   devin -p /usage          (prints a deterministic usage table)
//   devin list --format json (prints a deterministic session list)
//   devin -r <session-id>    (prints a deterministic resume banner)
//   devin <anything else>    (echoes args + env summary)
//
// Behavior can be tweaked via env vars:
//   DSW_FAKE_FAIL_LOGIN=1    -> auth login exits 1
//   DSW_FAKE_NEEDS_LOGIN=1   -> auth status / /usage report not logged in
//   DSW_FAKE_QUOTA_TIER=Trial       -> override usage tier
//   DSW_FAKE_QUOTA_USED=0           -> override used percentage
//   DSW_FAKE_QUOTA_REMAINING=100    -> override remaining percentage
//   DSW_FAKE_QUOTA_RESETS_IN=5h 41m -> override relative reset time
//   DSW_FAKE_QUOTA_RESET_AT=May 7, 3:00 PM (UTC+7) -> override absolute reset time
//   DSW_FAKE_QUOTA_BY_PROFILE_JSON={"profile-id":{"remaining":"0","used":"100"}} -> per-profile usage override
//   DSW_FAKE_USAGE_HANG=1          -> keep /usage running until killed
//   DSW_FAKE_SESSION_ID=abc123     -> session id shown by interactive/resume output
//   DSW_FAKE_EMAIL=foo@bar   -> override the email used by auth status
//   DSW_FAKE_NAME=Foo Bar     -> override the name used by auth status
//
// When invoked with no args and DSW_FAKE_PTY=1 the shim drops into a tiny
// interactive REPL that responds to `/usage` and `/exit`, matching the way
// hidden PTY quota probes drive the real devin CLI.

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
  if (process.env.DSW_FAKE_NAME) console.log(`Name: ${process.env.DSW_FAKE_NAME}`);
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
  if (process.env.DSW_FAKE_USAGE_HANG === '1') {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
  }
  const profileQuota = quotaForProfile();
  const tier = profileQuota.tier ?? process.env.DSW_FAKE_QUOTA_TIER ?? 'Trial';
  const used = profileQuota.used ?? process.env.DSW_FAKE_QUOTA_USED ?? '0';
  const remaining = profileQuota.remaining ?? process.env.DSW_FAKE_QUOTA_REMAINING ?? '100';
  const resetsIn = profileQuota.resetsIn ?? process.env.DSW_FAKE_QUOTA_RESETS_IN ?? '5h 41m';
  const resetAt = profileQuota.resetAt ?? process.env.DSW_FAKE_QUOTA_RESET_AT ?? 'May 7, 3:00 PM (UTC+7)';
  if (remaining === '0') {
    console.log('Error: Agent error: Your daily usage quota has been exhausted.');
  }
  console.log(`${tier} \u00b7 ${remaining}% remaining (resets in ${resetsIn})`);
  console.log('');
  console.log('Fetching quota...');
  console.log('');
  console.log(`Quota used: ${used}% (remaining: ${remaining}%)`);
  console.log(`Quota resets ${resetAt}.`);
  return 0;
}

function quotaForProfile(): Record<string, string | undefined> {
  if (!process.env.DSW_FAKE_QUOTA_BY_PROFILE_JSON) return {};
  const profileId = currentProfileId();
  if (!profileId) return {};
  try {
    const parsed = JSON.parse(process.env.DSW_FAKE_QUOTA_BY_PROFILE_JSON) as Record<string, Record<string, string | undefined>>;
    return parsed[profileId] ?? {};
  } catch {
    return {};
  }
}

function currentProfileId(): string | null {
  const dataHome = process.env.XDG_DATA_HOME;
  if (!dataHome) return null;
  const parts = dataHome.split(path.sep);
  const profilesIndex = parts.lastIndexOf('profiles');
  if (profilesIndex === -1) return null;
  return parts[profilesIndex + 1] ?? null;
}

function interactive(): void {
  console.log('fake-devin interactive prompt');
  console.log(`Session ID: ${fakeSessionId()}`);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    if (chunk.includes('/usage')) {
      usage();
    }
    if (chunk.includes(':rotate')) {
      console.log('fake-devin saw :rotate');
    }
    if (chunk.includes('/exit')) {
      process.exit(0);
    }
  });
  setInterval(() => undefined, 60_000);
}

function fakeSessionId(): string {
  return process.env.DSW_FAKE_SESSION_ID ?? `fake-session-${currentProfileId() ?? 'default'}`;
}

function main(): number | void {
  if (args.length === 0 && process.env.DSW_FAKE_PTY === '1') return interactive();
  if (args.length === 0) {
    console.log('fake-devin invoked with no args');
    return 0;
  }
  if (args[0] === '--version') {
    console.log('devin 0.0.0-fake');
    return 0;
  }
  if (args[0] === 'auth' && args[1] === 'login') return authLogin();
  if (args[0] === 'auth' && args[1] === 'status') return authStatus();
  if (args[0] === 'list' && args[1] === '--format' && args[2] === 'json') {
    console.log(JSON.stringify([{ id: fakeSessionId(), status: 'active' }]));
    return 0;
  }
  if (args[0] === '-p' && args[1] === '/usage') return usage();
  if (args[0] === '--print' && args[1] === '/usage') return usage();
  if (args[0] === '-r' && args[1]) {
    console.log(`Resuming session ${args[1]}`);
    console.log(`Session ID: ${args[1]}`);
    console.log(`XDG_DATA_HOME=${process.env.XDG_DATA_HOME ?? ''}`);
    return 0;
  }
  console.log(`fake-devin invoked with: ${JSON.stringify(args)}`);
  console.log(`Session ID: ${fakeSessionId()}`);
  console.log(`XDG_DATA_HOME=${process.env.XDG_DATA_HOME ?? ''}`);
  return 0;
}

const exitCode = main();
if (typeof exitCode === 'number') process.exit(exitCode);
