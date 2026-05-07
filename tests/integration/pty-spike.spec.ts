import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeDevinPath } from '../helpers/sandbox';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

describe('node-pty validation spike', () => {
  it('loads node-pty and forwards fake Devin stdio through a PTY', async () => {
    const pty = await import('node-pty');
    const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-pty-spike-data-'));
    const configHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-pty-spike-config-'));
    const credentialPath = path.join(dataHome, 'devin', 'credentials.toml');
    fs.mkdirSync(path.dirname(credentialPath), { recursive: true });
    fs.writeFileSync(credentialPath, '# fake credential\n');

    const term = pty.spawn(process.execPath, [TSX_CLI, fakeDevinPath()], {
      cols: 80,
      rows: 24,
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DSW_FAKE_PTY: '1',
        DSW_FAKE_SESSION_ID: 'pty-session-123',
        XDG_DATA_HOME: dataHome,
        XDG_CONFIG_HOME: configHome
      }
    });

    let output = '';
    const exitPromise = new Promise<number | undefined>((resolve) => {
      term.onExit(({ exitCode }) => resolve(exitCode));
    });
    term.onData((chunk) => {
      output += chunk;
    });

    await waitFor(() => output.includes('Session ID: pty-session-123'));
    term.resize(100, 30);
    term.write('/usage\r');
    await waitFor(() => output.includes('Quota used:'));
    term.write(':rotate\r');
    await waitFor(() => output.includes('fake-devin saw :rotate'));
    term.write('/exit\r');

    try {
      await expect(exitPromise).resolves.toBe(0);
      expect(output).toContain('fake-devin interactive prompt');
      expect(output).toContain('Quota resets');
    } finally {
      fs.rmSync(dataHome, { recursive: true, force: true });
      fs.rmSync(configHome, { recursive: true, force: true });
    }
  }, 10_000);
});

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for PTY output');
}
