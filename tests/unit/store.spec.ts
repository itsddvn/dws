import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountStore } from '../../src/core/store';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

describe('AccountStore', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  it('returns empty list when no store file exists', () => {
    const store = new AccountStore(sandbox.paths);
    expect(store.list()).toEqual([]);
  });

  it('creates accounts and persists them to JSON', () => {
    const store = new AccountStore(sandbox.paths);
    const created = store.create('primary');
    expect(created.name).toBe('primary');
    expect(created.needsLogin).toBe(true);

    const reread = new AccountStore(sandbox.paths);
    expect(reread.list().map((account) => account.name)).toEqual(['primary']);
    expect(fs.existsSync(sandbox.paths.storePath)).toBe(true);
  });

  it('rejects duplicate names', () => {
    const store = new AccountStore(sandbox.paths);
    store.create('primary');
    expect(() => store.create('primary')).toThrow(/already exists/);
  });

  it('rejects invalid characters in name', () => {
    const store = new AccountStore(sandbox.paths);
    expect(() => store.create('with space')).toThrow();
    expect(() => store.create('emoji😀')).toThrow();
  });

  it('renames accounts', () => {
    const store = new AccountStore(sandbox.paths);
    const created = store.create('pending');
    const renamed = store.rename(created.id, 'primary');
    expect(renamed.name).toBe('primary');
    expect(store.list().map((account) => account.name)).toEqual(['primary']);
  });

  it('updates auth metadata and clears needsLogin', () => {
    const store = new AccountStore(sandbox.paths);
    const created = store.create('work');
    const updated = store.setAuthMetadata(created.id, {
      email: 'foo@example.com',
      tier: 'pro',
      plan: 'Pro',
      orgId: 'org-abc'
    });
    expect(updated.email).toBe('foo@example.com');
    expect(updated.orgId).toBe('org-abc');
    expect(updated.needsLogin).toBe(false);
  });

  it('removes accounts', () => {
    const store = new AccountStore(sandbox.paths);
    store.create('one');
    store.create('two');
    store.remove('one');
    expect(store.list().map((account) => account.name)).toEqual(['two']);
  });

  it('touchLastUsed bumps lastUsedAt', () => {
    const store = new AccountStore(sandbox.paths);
    const created = store.create('lru');
    expect(created.lastUsedAt).toBeNull();
    const after = store.touchLastUsed(created.id);
    expect(after.lastUsedAt).not.toBeNull();
  });
});
