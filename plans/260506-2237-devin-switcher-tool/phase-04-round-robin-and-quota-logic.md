# Phase 4: Selection And Quota Logic

## Context Links

- [Research Report](./reports/research-report.md)
- [Research Addendum: Quota Model](./reports/research-addendum-quota-model.md)
- [Product And Technical Design](./phase-01-product-and-technical-design.md)

## Overview

Priority: P1
Status: Completed
Goal: implement account selection, per-profile locking, server-side quota tracking, and automatic limit marking. Selection supports three strategies. Quota source is server-authoritative with layered fallbacks.

## Requirements

- Support three selection strategies: `manual`, `quota-weighted`, `round-robin`.
- Skip disabled, locked, limited, quota-exhausted, and needs-login profiles.
- Poll server quota per profile on schedule and on session end.
- Detect quota exhaustion from `finish_reason: quota_exhausted` without any output parsing.
- Detect limit from stdout string fallback when structured signal is unavailable.
- Distinguish `quota_exhausted` from `Turn limit reached` (not quota).
- Distinguish `Rate limited:` (cooldown) from full exhaustion.
- Handle stale locks from crashed sessions.
- Support manual override (`mark-limited`, `unmark`) that trumps automatic detection.

## Architecture

### Selection pipeline

```text
dsw next --strategy <s>
  -> scheduler.selectNext(strategy)
     -> applyEligibilityFilter(accounts, locks, quota_snapshots, settings.reserve_pct)
     -> rank(eligible, strategy)
     -> acquireLock(accountId, sessionId)
     -> return account
```

### Eligibility filter

```ts
eligible(account) =
     account.enabled
  && account.status in {'ready', 'unknown'}
  && not profileLockIsLive(account.id)                 // lock TTL honored
  && (quotaOk(account, 'daily', reserve_pct) || quotaUnknown(account))
  && (quotaOk(account, 'weekly', reserve_pct) || quotaUnknown(account))
  && not isInLimitedUntil(account)
```

`quotaUnknown` = no snapshot yet. We allow selection under unknown state to avoid deadlock on first use; first session will either succeed (populates snapshot) or fail with `quota_exhausted` (flips to limited).

### Strategy rank

```ts
switch (strategy) {
  case 'manual':
    return [];  // UI/CLI handles pick; use suggestion() to highlight a default
  case 'quota-weighted':
    return sortDesc(eligible, a => Math.min(a.daily_pct ?? 100, a.weekly_pct ?? 100))
             .tiebreak(a => a.order_index);
  case 'round-robin':
    const idx = findIndex(eligible, a => a.id === cursor.last_selected_account_id);
    return rotate(eligible, idx + 1);  // stable by order_index
}
```

`quota-weighted` suggestion is also what UI shows under `manual` as a hint.

### Session lifecycle and locking

```text
runner.start(profile, args)
  1. write session row (status=starting)
  2. INSERT OR FAIL into profile_locks with pid/heartbeat
  3. spawn devin child with XDG env; attach stdio
  4. 30s heartbeat_at updater goroutine
  5. parse structured events only when the selected Devin run mode exposes them; otherwise tail stdout/stderr fallback
  6. on child exit:
       stop heartbeat
       write finish_reason, exit_code, ended_at
       DELETE profile_locks row
       enqueue quota refetch for this account
       emit event session_end
```

### Stale lock handling

```text
On dsw next / run:
  for each lock:
    if now - heartbeat_at > 120s:
      if pid is not alive (kill -0 fails):
        delete lock
        emit event stale_lock_cleaned
      else:
        leave intact (session is just slow)
```

`dsw doctor` performs the same sweep on demand.

### Quota polling

```text
poller loop, every settings.poll_interval_minutes:
  for each account where enabled AND status != 'needs_login':
    try fetchQuota(account)
      -> hit the endpoint captured in Phase 1 spike
      -> auth header uses account's JWT
    on 200: parse -> persist QuotaSnapshot -> update derived status
    on 401: mark 'needs_login'
    on 429 / temp fail: record event, keep old snapshot
    on 3x consecutive failures: mark 'error', surface in UI

on session end:
  trigger one immediate fetchQuota for that account (bypass schedule)
```

### Reset handling

- `daily_reset_at` and `weekly_reset_at` come from server; use them verbatim.
- A background tick every minute checks `limited` accounts: if `now >= reset_at`, transition to `ready` and enqueue quota refetch.
- No local assumption about timezone or "UTC Monday reset" — always trust server timestamps.

### Limit detection (layered)

```text
(1) Structured, when observable:
    finish_reason == "quota_exhausted"                        -> limited
    finish_reason == "auth_required"                          -> needs_login
    finish_reason == "max_turn_requests"                      -> NOT limited; informational only

(2) Output fallback (only if (1) absent):
    literal "Quota exhausted"                                 -> limited
    literal "Upgrade your plan or wait for your quota to reset"-> limited
    literal "Rate limited:"                                   -> transient cooldown (5 min), NOT limited
    literal "Failed to fetch quota:"                          -> quota_error event only

(3) Poll fallback:
    daily_remaining_pct == 0 OR weekly_remaining_pct == 0      -> limited
```

Hardcoded in `src/core/quota/signals.ts`; user-overridable via `settings.limit_patterns`.

### Manual override precedence

```text
explicit mark-limited (limited_until != null)
  > structured finish_reason
  > poll-derived limited
  > stdout pattern
  > default ready
```

`unmark` clears `limited_until`, re-triggers poll, lets poll re-decide.

## Related Code Files

Create/modify:

- `/Users/itsddvn/projects/devin-switcher/src/core/scheduler/eligibility.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/scheduler/strategies.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/scheduler/cursor.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/quota/poller.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/quota/signals.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/quota/endpoint.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/runner/lifecycle.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/runner/stream-parser.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/runner/locks.ts`
- `/Users/itsddvn/projects/devin-switcher/src/db/queries/accounts.ts`
- `/Users/itsddvn/projects/devin-switcher/src/db/queries/quota.ts`
- `/Users/itsddvn/projects/devin-switcher/src/db/queries/sessions.ts`

## Implementation Steps

1. Apply SQLite schema from Phase 1; add migrations for `accounts`, `quota_snapshots`, `sessions`, `profile_locks`, `events`, `settings`.
2. Implement `eligibility.ts` + unit tests over fixtures.
3. Implement three strategies in `strategies.ts` with deterministic tie-breaking.
4. Implement cursor persistence and recovery (cursor may reference a removed account).
5. Implement lock acquire/heartbeat/release with SQLite `INSERT OR FAIL`.
6. Implement `endpoint.ts` using the URL/request shape from Phase 1 spike; wrap JWT loading from profile credential.
7. Implement `poller.ts` with backoff + circuit breaker.
8. Implement `stream-parser.ts` using Phase 1's run-mode observability matrix. Parse structured events only in modes that prove they emit them; fall back to line matching for plain stdio.
9. Implement `lifecycle.ts` to orchestrate start/heartbeat/exit and derive final status.
10. Implement manual override commands (`mark-limited`, `unmark`, `disable`, `enable`).
11. Emit `events` rows at each decision point.
12. Tests: eligibility edge cases, strategy ordering, cursor wrap-around, stale lock TTL, 401/429 handling, `finish_reason` ingestion, fallback string matching, reset rollover.

## Todo List

- [x] Migrations applied.
- [x] Eligibility filter + tests.
- [x] Manual strategy (suggestion only).
- [x] Quota-weighted strategy + tests.
- [x] Round-robin strategy + cursor + tests.
- [x] Profile lock acquire/heartbeat/release.
- [x] Stale lock cleanup.
- [x] Quota endpoint client with JWT loader.
- [x] Quota poller with backoff.
- [x] Structured JSON line parser for observable `finish_reason`.
- [x] Stdout pattern fallback parser.
- [x] Session lifecycle orchestration.
- [x] Manual override commands.
- [x] Event log writes at all decision points.
- [x] Unit tests across eligibility, strategies, signals, reset, overrides.

## Success Criteria

- Account exhausted by `finish_reason: quota_exhausted` is marked `limited` within one second of session end. Verified with fake `devin`.
- Account with `daily_remaining_pct == 0` is not selected under any strategy. Tested.
- Manual `mark-limited` wins over a fresh successful poll. Tested.
- `unmark` followed by immediate `dsw next` re-evaluates eligibility against the latest snapshot. Endpoint polling is opt-in until live endpoint validation in Phase 6.
- Round-robin cursor is stable and survives process restart. Implemented.
- Quota-weighted selection picks the account with the highest `min(daily, weekly)` above reserve. Tested.
- Stale lock from a killed `devin` is cleaned on next operation without user action. Implemented.
- `Turn limit reached` does NOT mark an account limited. Tested through signal classifier.
- `Rate limited:` triggers a short cooldown event but account stays `ready`. Implemented through `limit_cooldowns` and event logging.

## Completion Log

### 2026-05-06

- Verified the existing baseline: typecheck and tests passed before continuing.
- Added manual selection suggestion semantics.
- Added opt-in quota endpoint client with per-profile JWT loading, HTTPS enforcement, payload normalization, and redaction.
- Added quota poller with snapshot persistence, manual override precedence, backoff/circuit events, 401 handling, and zero-quota derived status.
- Added event logging for account state changes, sessions, locks, quota polling, cooldowns, and stale lock cleanup.
- Expanded tests from 7 to 11 assertions across strategy, zero-quota exclusion, quota polling, and manual override precedence.

## Risk Assessment

- **Endpoint changes across Devin versions.** Mitigation: detect unexpected payload → log + degrade to fallback layers; surface in `dsw doctor`.
- **Structured finish signal unavailable** for interactive mode. Mitigation: parser covers plain stdio too; tests cover each supported run mode from the Phase 1 matrix.
- **Racing between user `Ctrl+C` and heartbeat** may leave a lock. Mitigation: TTL-based cleanup + PID liveness check.
- **JWT expiry mid-session** mis-classed as limited. Mitigation: 401 maps to `needs_login`, never `limited`; `finish_reason: auth_required` reinforces.
- **Interactive long sessions distort "usage" heuristics.** Mitigation: drop usage-time heuristic entirely in favor of server snapshot + finish_reason.

## Security Considerations

- Never log JWT or `Authorization` header value. Redact before writing to `events.payload_json`.
- Stream parser must cap line buffer (avoid OOM from unbounded lines).
- Quota endpoint client must enforce HTTPS; refuse HTTP unless `DSW_ALLOW_INSECURE=1` is set (dev only).
- Stored raw quota payload should redact any field whose value matches the JWT regex even if unlikely.

## Next Steps

Expose endpoints and data in Phase 5 UI.
