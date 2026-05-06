const JWT_RE = /eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){0,2}/g;
const DEVIN_SESSION_RE = /devin-session-token\$[A-Za-z0-9._-]*/g;

export function redactText(input: string): string {
  return input
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(DEVIN_SESSION_RE, '[REDACTED_DEVIN_SESSION_TOKEN]')
    .replace(/(authorization\s*[:=]\s*)\S+/gi, '$1[REDACTED_AUTH]')
    .replace(/(windsurf_api_key\s*[:=]\s*)\S+/gi, '$1[REDACTED]');
}
