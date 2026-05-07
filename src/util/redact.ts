// Order matters: more-specific patterns run first so they don't get
// shadowed by the broader sweeps.
const JWT_RE = /eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){0,2}/g;
const DEVIN_SESSION_RE = /devin-session-token\$[A-Za-z0-9._-]*/g;
// JSON / object-literal form: "authorization":"<value>" — preserves the
// surrounding quotes so the redacted line still parses as JSON.
const JSON_FIELD_RE = /("(?:authorization|api[_-]?key|access[_-]?key|windsurf_api_key)"\s*:\s*")[^"]+(")/gi;
// Single-quoted JSON-ish form (e.g. Python/TOML output).
const JSON_FIELD_SINGLE_RE = /('(?:authorization|api[_-]?key|access[_-]?key|windsurf_api_key)'\s*:\s*')[^']+(')/gi;
// Unquoted form: `authorization: <value>` or `api_key=<value>`.
const SHELL_FIELD_RE = /\b(authorization|api[_-]?key|access[_-]?key|windsurf_api_key)(\s*[:=]\s*)(\S+)/gi;
// Defense-in-depth: any `Bearer <token>` outside an authorization field.
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._\-+/=]+/g;

export function redactText(input: string): string {
  return input
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(DEVIN_SESSION_RE, '[REDACTED_DEVIN_SESSION_TOKEN]')
    // `Bearer <token>` first so a shell-style `Authorization: Bearer xxx`
    // doesn't leak the `xxx` past the SHELL_FIELD_RE single-token capture.
    .replace(BEARER_RE, 'Bearer [REDACTED]')
    .replace(JSON_FIELD_RE, '$1[REDACTED]$2')
    .replace(JSON_FIELD_SINGLE_RE, '$1[REDACTED]$2')
    .replace(SHELL_FIELD_RE, '$1$2[REDACTED]');
}
