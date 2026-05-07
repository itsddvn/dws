import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareProfileRuntime, persistProfileRuntime } from '../../src/core/profile-runtime';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

describe('profile runtime', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it('shares Devin CLI state while keeping profile credentials isolated', () => {
    const profile = prepareProfileRuntime('profile-a', sandbox.paths, sandbox.env);
    const profileCli = path.join(profile.devinDataDir, 'cli');
    const sharedCli = path.join(sandbox.dataHome, 'devin', 'cli');

    expect(fs.lstatSync(profileCli).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(profileCli)).toBe(fs.realpathSync(sharedCli));
    expect(profile.credentialsPath).toBe(path.join(sandbox.dataHome, 'profiles', 'profile-a', 'data', 'devin', 'credentials.toml'));
  });

  it('migrates existing isolated CLI state before linking to shared state', () => {
    const profileCli = path.join(sandbox.dataHome, 'profiles', 'profile-old', 'data', 'devin', 'cli');
    fs.mkdirSync(profileCli, { recursive: true });
    fs.writeFileSync(path.join(profileCli, 'trusted_workspaces.json'), '[]');

    prepareProfileRuntime('profile-old', sandbox.paths, sandbox.env);

    const sharedCli = path.join(sandbox.dataHome, 'devin', 'cli');
    expect(fs.existsSync(path.join(sharedCli, 'trusted_workspaces.json'))).toBe(true);
    expect(fs.lstatSync(profileCli).isSymbolicLink()).toBe(true);
  });

  it('copies shared settings into a profile without replacing the profile org id', () => {
    const sharedConfig = path.join(sandbox.configHome, 'devin', 'config.json');
    fs.mkdirSync(path.dirname(sharedConfig), { recursive: true });
    fs.writeFileSync(
      sharedConfig,
      JSON.stringify({
        devin: { org_id: 'shared-org' },
        shell: { setup_complete: true },
        theme_mode: 'dark',
        agent: { model: 'opus' }
      })
    );

    let profile = prepareProfileRuntime('profile-b', sandbox.paths, sandbox.env);
    const profileConfig = path.join(profile.devinConfigDir, 'config.json');
    fs.writeFileSync(profileConfig, JSON.stringify({ devin: { org_id: 'profile-org' }, theme_mode: 'light' }));

    profile = prepareProfileRuntime('profile-b', sandbox.paths, sandbox.env);
    const parsed = JSON.parse(fs.readFileSync(path.join(profile.devinConfigDir, 'config.json'), 'utf8')) as {
      devin: { org_id: string };
      shell: { setup_complete: boolean };
      theme_mode: string;
      agent: { model: string };
    };

    expect(parsed.devin.org_id).toBe('profile-org');
    expect(parsed.shell.setup_complete).toBe(true);
    expect(parsed.theme_mode).toBe('dark');
    expect(parsed.agent.model).toBe('opus');
  });

  it('persists profile settings back to shared config without leaking the profile org id', () => {
    const sharedConfig = path.join(sandbox.configHome, 'devin', 'config.json');
    fs.mkdirSync(path.dirname(sharedConfig), { recursive: true });
    fs.writeFileSync(sharedConfig, JSON.stringify({ devin: { org_id: 'shared-org' }, theme_mode: 'dark' }));

    const profile = prepareProfileRuntime('profile-c', sandbox.paths, sandbox.env);
    fs.writeFileSync(
      path.join(profile.devinConfigDir, 'config.json'),
      JSON.stringify({ devin: { org_id: 'profile-org' }, theme_mode: 'light', agent: { model: 'sonnet' } })
    );

    persistProfileRuntime('profile-c', sandbox.paths, sandbox.env);
    const parsed = JSON.parse(fs.readFileSync(sharedConfig, 'utf8')) as {
      devin: { org_id: string };
      theme_mode: string;
      agent: { model: string };
    };

    expect(parsed.devin.org_id).toBe('shared-org');
    expect(parsed.theme_mode).toBe('light');
    expect(parsed.agent.model).toBe('sonnet');
  });
});
