#!/usr/bin/env tsx

const args = process.argv.slice(2);
const scenario = process.env.DSW_FAKE_DEVIN_SCENARIO ?? 'completed';

if (args[0] === 'auth' && args[1] === 'status') {
  runAuthStatus();
} else {
  runScenario(scenario);
}

function runAuthStatus(): void {
  if (process.env.DSW_FAKE_DEVIN_AUTH === 'missing') {
    console.log('Not logged in.');
    process.exit(1);
  }

  console.log(`Logged in (via Devin).

User:
  Name: Fake User
  Email: fake@example.com
  User ID: fake-user

Account:
  Tier: Devin Trial
  Plan: Trial
  Team ID: fake-team`);
}

function runScenario(name: string): void {
  switch (name) {
    case 'completed':
      console.log(JSON.stringify({ type: 'session_finished', finish_reason: 'completed' }));
      process.exit(0);
      break;
    case 'quota_exhausted':
      console.log(JSON.stringify({ type: 'session_finished', finish_reason: 'quota_exhausted' }));
      process.exit(0);
      break;
    case 'auth_required':
      console.error(JSON.stringify({ type: 'session_finished', finish_reason: 'auth_required' }));
      process.exit(1);
      break;
    case 'rate_limited_then_completed':
      console.error('Rate limited: retry after 60 seconds');
      console.log(JSON.stringify({ type: 'session_finished', finish_reason: 'completed' }));
      process.exit(0);
      break;
    case 'turn_limit':
      console.log('Turn limit reached');
      console.log(JSON.stringify({ type: 'session_finished', finish_reason: 'completed' }));
      process.exit(0);
      break;
    case 'leak_token':
      console.log('authorization: devin-session-token$secret');
      console.log(JSON.stringify({ type: 'session_finished', finish_reason: 'completed' }));
      process.exit(0);
      break;
    case 'split_token_and_finish_reason':
      process.stdout.write('authorization: devin-session-token$');
      process.stdout.write('secret\n');
      process.stdout.write('{"type":"session_finished",');
      process.stdout.write('"finish_reason":"quota_exhausted"}\n');
      process.exit(0);
      break;
    case 'acp_quota_exhausted':
      console.log(JSON.stringify({ jsonrpc: '2.0', method: 'session/finished', params: { finish_reason: 'quota_exhausted' } }));
      process.exit(0);
      break;
    case 'crash':
      console.error('fake devin crash');
      process.exit(2);
      break;
    default:
      console.error(`Unknown fake devin scenario: ${name}`);
      process.exit(64);
  }
}
