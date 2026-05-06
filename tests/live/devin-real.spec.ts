import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { execa } from 'execa';
import { resolveAppPaths } from '../../src/config/paths';
import { openAppDatabase } from '../../src/db/client';
import { AccountService } from '../../src/core/accounts/service';
import { sha256File } from '../../src/core/profiles/import';
import { resolveProfilePaths } from '../../src/core/profiles/paths';
import { readAuthStatus } from '../../src/core/profiles/auth-status';
import { runDevinWithAccount } from '../../src/core/runner/lifecycle';

const runLive = process.env.DSW_LIVE === '1';
const liveDescribe = runLive ? describe : describe.skip;

liveDescribe('real Devin CLI integration', () => {
  it('validates two real profiles without mutating global credentials', async () => {
    const first = process.env.DSW_LIVE_PROFILE_1 ?? 'primary';
    const second = process.env.DSW_LIVE_PROFILE_2 ?? 'secondary';
    const globalCredential = path.join(os.homedir(), '.local', 'share', 'devin', 'credentials.toml');
    const before = fs.existsSync(globalCredential) ? sha256File(globalCredential) : null;

    await execa('devin', ['--version']);
    const appPaths = resolveAppPaths();
    const db = openAppDatabase({ paths: appPaths });
    const service = new AccountService(db, appPaths);

    try {
      for (const name of [first, second]) {
        const account = service.list().find((candidate) => candidate.name === name);
        expect(account, `${name} profile must already exist; run dsw add/import-global before live tests`).toBeDefined();
        if (!account) {
          throw new Error(`${name} profile must already exist`);
        }
        const credentialPath = resolveProfilePaths(account.id, appPaths).credentialsPath;
        expect(fs.existsSync(credentialPath), `${name} profile must be logged in before live tests`).toBe(true);

        const auth = await readAuthStatus(account.id, appPaths);
        expect(auth.loggedIn).toBe(true);
        expect(auth.rawRedacted).not.toContain('devin-session-token$');
      }

      const primary = service.getByName(first);
      const exitCode = await runDevinWithAccount({ account: primary, args: ['-p', 'echo hi'], strategy: 'manual' });
      const session = db.prepare('SELECT finish_reason, exit_code FROM sessions ORDER BY started_at DESC LIMIT 1').get() as {
        finish_reason: string | null;
        exit_code: number | null;
      };
      const after = fs.existsSync(globalCredential) ? sha256File(globalCredential) : null;

      expect(exitCode).toBe(0);
      expect(session.exit_code).toBe(0);
      expect(after).toBe(before);
    } finally {
      db.close();
    }
  });
});
