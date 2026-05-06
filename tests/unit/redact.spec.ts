import { describe, expect, it } from 'vitest';
import { redactText } from '../../src/util/redact';

describe('redactText', () => {
  it('redacts JWT-like strings', () => {
    const input = 'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature done';
    expect(redactText(input)).not.toContain('eyJ');
    expect(redactText(input)).toContain('[REDACTED_JWT]');
  });

  it('redacts devin session tokens', () => {
    const input = 'Cookie: devin-session-token$abc.def-ghi';
    expect(redactText(input)).toContain('[REDACTED_DEVIN_SESSION_TOKEN]');
    expect(redactText(input)).not.toContain('devin-session-token$abc.def-ghi');
  });

  it('redacts authorization headers', () => {
    const input = 'Authorization: Bearer secret123';
    expect(redactText(input)).toContain('[REDACTED_AUTH]');
  });
});
