import { describe, expect, it } from 'vitest';
import { redactText } from '../../src/util/redact';

describe('redactText', () => {
  it('redacts JWT-like strings', () => {
    const input = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature done';
    const result = redactText(input);
    expect(result).not.toContain('eyJ');
    expect(result).toContain('[REDACTED_JWT]');
  });

  it('redacts devin session tokens', () => {
    const input = 'Cookie: devin-session-token$abc.def-ghi';
    const result = redactText(input);
    expect(result).toContain('[REDACTED_DEVIN_SESSION_TOKEN]');
    expect(result).not.toContain('devin-session-token$abc.def-ghi');
  });

  it('redacts shell-style authorization headers', () => {
    const input = 'Authorization: Bearer secret123';
    const result = redactText(input);
    expect(result).not.toContain('secret123');
    expect(result).toMatch(/\[REDACTED/);
  });

  it('redacts quoted JSON-style authorization fields without breaking the JSON shape', () => {
    const input = '{"authorization":"Bearer abc.def_ghi","other":"value"}';
    const result = redactText(input);
    expect(result).not.toContain('abc.def_ghi');
    expect(result).toContain('"authorization":"[REDACTED]"');
    expect(result).toContain('"other":"value"');
  });

  it('redacts standalone Bearer tokens elsewhere in a string', () => {
    const input = 'curl -H "X-Token: Bearer plaintoken-abc-123"';
    const result = redactText(input);
    expect(result).not.toContain('plaintoken-abc-123');
    expect(result).toContain('Bearer [REDACTED]');
  });

  it('redacts api_key / access_key style fields and preserves surrounding quotes', () => {
    expect(redactText('api_key: abc-123')).not.toContain('abc-123');
    expect(redactText('"api-key":"abc-123"')).toContain('"api-key":"[REDACTED]"');
    expect(redactText('access_key=PLAINKEY')).toContain('access_key=[REDACTED]');
  });

  it('redacts windsurf_api_key', () => {
    const input = 'windsurf_api_key=secretvalue123';
    const result = redactText(input);
    expect(result).toContain('windsurf_api_key=[REDACTED]');
    expect(result).not.toContain('secretvalue123');
  });
});
