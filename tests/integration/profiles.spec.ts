import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { temporaryDirectory } from 'tempy';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';
import { AccountService } from '../../src/core/accounts/service';
import { buildProfileEnv } from '../../src/core/profiles/env';
import { importCredential, sha256File } from '../../src/core/profiles/import';
import { parseAuthStatus } from '../../src/core/profiles/auth-status';

describe('profile management', () => {
  it('imports a global credential copy without changing the source', () => {
    const root = temporaryDirectory();
    const sourcePath = path.join(root, 'global', 'credentials.toml');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'windsurf_api_key = "secret"\n');
    const before = sha256File(sourcePath);

    const appPaths = resolveAppPaths({
      ...process.env,
      DSW_DATA_HOME: path.join(root, 'data'),
      DSW_CONFIG_HOME: path.join(root, 'config')
    });
    const db = openAppDatabase({ paths: appPaths });
    const service = new AccountService(db, appPaths);
    const account = service.create('primary');

    const result = importCredential(account.id, { sourcePath, appPaths });
    const after = sha256File(sourcePath);
    db.close();

    expect(after).toBe(before);
    expect(result.sourceSha256).toBe(result.targetSha256);
    expect(fs.readFileSync(result.targetPath, 'utf8')).toContain('windsurf_api_key');
    expect(fs.statSync(result.targetPath).mode & 0o777).toBe(0o600);
  });

  it('builds isolated XDG env for a profile', () => {
    const root = temporaryDirectory();
    const appPaths = resolveAppPaths({
      ...process.env,
      DSW_DATA_HOME: path.join(root, 'data'),
      DSW_CONFIG_HOME: path.join(root, 'config')
    });
    const env = buildProfileEnv('profile-1', appPaths, {});

    expect(env.XDG_DATA_HOME).toContain(path.join('profiles', 'profile-1', 'data'));
    expect(env.XDG_CONFIG_HOME).toContain(path.join('profiles', 'profile-1', 'config'));
  });

  it('parses auth status without retaining credentials', () => {
    const parsed = parseAuthStatus(`
Logged in (via Devin).

Credentials:
  File: /tmp/credentials.toml
  API server: https://server.codeium.com

User:
  Name: Example User
  Email: user@example.com
  User ID: user-123

Account:
  Tier: Devin Trial
  Plan: Trial
  Team ID: team-123
`);

    expect(parsed.loggedIn).toBe(true);
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.tier).toBe('Devin Trial');
    expect(parsed.plan).toBe('Trial');
    expect(parsed.teamId).toBe('team-123');
  });
});
