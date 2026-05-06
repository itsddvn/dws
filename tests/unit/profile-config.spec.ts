import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProfileOrgId, usageUrlForOrg } from '../../src/core/profile-config';
import { ensureProfileDirs } from '../../src/core/profile-paths';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

describe('readProfileOrgId', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it('returns null when the profile config file is missing', () => {
    const profilePaths = ensureProfileDirs('profile-x', sandbox.paths);
    expect(profilePaths.devinConfigDir).toBeTruthy();
    expect(readProfileOrgId('profile-x', sandbox.paths)).toBeNull();
  });

  it('returns null on malformed JSON without throwing', () => {
    const profilePaths = ensureProfileDirs('profile-y', sandbox.paths);
    fs.writeFileSync(path.join(profilePaths.devinConfigDir, 'config.json'), 'not json');
    expect(readProfileOrgId('profile-y', sandbox.paths)).toBeNull();
  });

  it('returns the org id when present', () => {
    const profilePaths = ensureProfileDirs('profile-z', sandbox.paths);
    fs.writeFileSync(
      path.join(profilePaths.devinConfigDir, 'config.json'),
      JSON.stringify({ devin: { org_id: 'org-abc-123' }, theme_mode: 'dark' })
    );
    expect(readProfileOrgId('profile-z', sandbox.paths)).toBe('org-abc-123');
  });
});

describe('usageUrlForOrg', () => {
  it('falls back to the org-less url when no org id is known', () => {
    expect(usageUrlForOrg(null)).toBe('https://app.devin.ai/settings/usage');
  });

  it('builds a per-org url when given an org id', () => {
    expect(usageUrlForOrg('org-abc')).toBe('https://app.devin.ai/org/org-abc/settings/usage');
  });

  it('url-encodes weird org ids', () => {
    expect(usageUrlForOrg('foo/bar')).toBe('https://app.devin.ai/org/foo%2Fbar/settings/usage');
  });
});
