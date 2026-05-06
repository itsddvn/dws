const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const DEVIN_SESSION_RE = /devin-session-token\$[A-Za-z0-9._-]+/g;

export function redactText(input: string): string {
  return input
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(DEVIN_SESSION_RE, '[REDACTED_DEVIN_SESSION_TOKEN]')
    .replace(/(authorization\s*[:=]\s*)\S+/gi, '$1[REDACTED_AUTH]')
    .replace(/(windsurf_api_key\s*[:=]\s*)\S+/gi, '$1[REDACTED]');
}

export function redactJson(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (/authorization|cookie|token|secret|windsurf_api_key/i.test(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactJson(nested);
      }
    }
    return output;
  }
  return value;
}
