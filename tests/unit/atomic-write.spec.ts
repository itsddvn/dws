import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWriteJsonSync, readJsonOrNull } from '../../src/util/atomic-write';

describe('atomicWriteJsonSync', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-atomic-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes and reads JSON round-trip', () => {
    const file = path.join(dir, 'value.json');
    atomicWriteJsonSync(file, { foo: 1, bar: ['a', 'b'] });
    expect(readJsonOrNull(file)).toEqual({ foo: 1, bar: ['a', 'b'] });
  });

  it('creates parent directories with restrictive permissions', () => {
    const file = path.join(dir, 'nested', 'deeper', 'value.json');
    atomicWriteJsonSync(file, { ok: true });
    expect(fs.existsSync(file)).toBe(true);
  });

  it('writes the file with mode 0o600', () => {
    const file = path.join(dir, 'value.json');
    atomicWriteJsonSync(file, {});
    const stat = fs.statSync(file);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('does not leave a temp file behind on success', () => {
    const file = path.join(dir, 'value.json');
    atomicWriteJsonSync(file, { ok: true });
    const siblings = fs.readdirSync(dir);
    expect(siblings).toEqual(['value.json']);
  });

  it('overwrites existing files atomically', () => {
    const file = path.join(dir, 'value.json');
    atomicWriteJsonSync(file, { v: 1 });
    atomicWriteJsonSync(file, { v: 2 });
    expect(readJsonOrNull(file)).toEqual({ v: 2 });
  });
});

describe('readJsonOrNull', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsw-atomic-read-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the file is missing', () => {
    expect(readJsonOrNull(path.join(dir, 'missing.json'))).toBeNull();
  });

  it('returns null when the file contains invalid JSON', () => {
    const file = path.join(dir, 'broken.json');
    fs.writeFileSync(file, 'not json');
    expect(readJsonOrNull(file)).toBeNull();
  });
});
