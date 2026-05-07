import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAppPaths } from '../../src/config/paths';

describe('resolveAppPaths', () => {
  it('uses one user-level data directory by default', () => {
    const paths = resolveAppPaths({ HOME: '/tmp/ignored-home' });

    expect(paths.appDataDir).toMatch(/\/\.dsw$/);
    expect(paths.appConfigDir).toBe(paths.appDataDir);
    expect(paths.storePath).toBe(path.join(paths.appDataDir, 'accounts.json'));
    expect(paths.profilesDir).toBe(path.join(paths.appDataDir, 'profiles'));
  });

  it('resolves explicit DSW overrides to absolute paths', () => {
    const paths = resolveAppPaths({
      DSW_DATA_HOME: 'relative-data',
      DSW_CONFIG_HOME: '~/relative-config',
      XDG_DATA_HOME: '/tmp/should-not-be-used',
      XDG_CONFIG_HOME: '/tmp/should-not-be-used'
    });

    expect(paths.dataHome).toBe(path.resolve('relative-data'));
    expect(path.isAbsolute(paths.configHome)).toBe(true);
    expect(paths.configHome).toMatch(/\/relative-config$/);
  });
});
