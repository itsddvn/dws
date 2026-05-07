import { describe, expect, it } from 'vitest';
import { slugifyAccountName, validateAccountName } from '../../src/util/account-name';

describe('validateAccountName', () => {
  it('accepts plain names', () => {
    expect(validateAccountName('work')).toBe('work');
    expect(validateAccountName('with-dash')).toBe('with-dash');
    expect(validateAccountName('with_underscore')).toBe('with_underscore');
    expect(validateAccountName('Capital123')).toBe('Capital123');
  });

  it('trims whitespace', () => {
    expect(validateAccountName('  work  ')).toBe('work');
  });

  it('rejects empty input', () => {
    expect(() => validateAccountName('')).toThrow(/required/);
    expect(() => validateAccountName('   ')).toThrow(/required/);
  });

  it('rejects invalid characters', () => {
    expect(() => validateAccountName('with space')).toThrow(/letters, numbers/);
    expect(() => validateAccountName('emoji😀')).toThrow();
    expect(() => validateAccountName('dot.in.name')).toThrow();
  });
});

describe('slugifyAccountName', () => {
  it('lowercases and replaces non-slug characters with dashes', () => {
    expect(slugifyAccountName('Jane Devin')).toBe('jane-devin');
    expect(slugifyAccountName('Foo Bar Baz')).toBe('foo-bar-baz');
    expect(slugifyAccountName('user@example.com')).toBe('user-example-com');
  });

  it('preserves dashes and underscores', () => {
    expect(slugifyAccountName('foo_bar-baz')).toBe('foo_bar-baz');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugifyAccountName('--foo--')).toBe('foo');
  });

  it('returns null when input has no usable characters', () => {
    expect(slugifyAccountName(null)).toBeNull();
    expect(slugifyAccountName(undefined)).toBeNull();
    expect(slugifyAccountName('')).toBeNull();
    expect(slugifyAccountName('   ')).toBeNull();
    expect(slugifyAccountName('!!!')).toBeNull();
  });
});
