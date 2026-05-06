# Limit Signals

## Overview

This document defines V1 quota and limit signal handling. It is intentionally conservative: only clear quota exhaustion marks an account `limited`.

## Structured Signals

When observable:

| Signal | Account Result | Notes |
|---|---|---|
| `finish_reason: quota_exhausted` | `limited` | Trusted exhaustion signal. |
| `finish_reason: auth_required` | `needs_login` | Never mark as limited. |
| `finish_reason: max_turn_requests` | `ready` + event | Conversation limit, not account quota. |
| `finish_reason: completed` | `ready` | Trigger quota refresh if endpoint enabled. |
| `finish_reason: cancelled` | unchanged | User action. |
| `finish_reason: interrupted` | unchanged | Session interruption. |

## Output Fallback Signals

Exact string matches:

| Text | Account Result |
|---|---|
| `Quota exhausted` | `limited` |
| `Upgrade your plan or wait for your quota to reset` | `limited` |
| `Rate limited:` | transient cooldown event, account remains `ready` |
| `Turn limit reached` | informational event, account remains `ready` |
| `Failed to fetch quota:` | quota error event, account status unchanged |

Matching rules:

- Case-sensitive exact substring for V1.
- Apply after redaction.
- Cap line length before scanning.
- Do not infer quota from generic 429 text unless paired with one of the exact strings above.

## Manual Overrides

Manual override precedence:

```text
explicit mark-limited
  > structured finish_reason
  > server quota snapshot
  > output fallback
  > default ready
```

`unmark` clears manual limited state and triggers re-evaluation.

## Test Fixtures

Phase 4 should include fixture cases:

```json
{"finish_reason":"quota_exhausted","expected_status":"limited"}
{"finish_reason":"auth_required","expected_status":"needs_login"}
{"finish_reason":"max_turn_requests","expected_status":"ready"}
{"line":"Quota exhausted","expected_status":"limited"}
{"line":"Upgrade your plan or wait for your quota to reset","expected_status":"limited"}
{"line":"Rate limited: retry later","expected_status":"ready","expected_event":"cooldown"}
{"line":"Turn limit reached","expected_status":"ready","expected_event":"info"}
```
