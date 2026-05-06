---
title: "Plan Validation Report"
description: "Validation review for Devin Switcher Tool implementation plan after quota model update."
created: 2026-05-06
plan: ../plan.md
status: auto-accepted
---

# Plan Validation Report

## Summary

Plan is directionally strong. The update from local timer quota to server-reported quota is correct. XDG profile isolation remains the right foundation.

The user invoked cook with `--auto`; recommended decisions below are treated as accepted for V1.

## Validated Decisions

| Decision | Result | Notes |
|---|---|---|
| XDG profile isolation | Valid | Best option. Avoids global credential replacement. |
| Not a proxy/router | Valid | Devin CLI has network proxy support, but no stable API routing layer. |
| SQLite local DB | Valid | Fits local-first app, locks, sessions, events. |
| Thin local web UI | Valid | Good V1 scope. Tauri deferred. |
| Server quota over local timer | Valid with caveat | Better model, but endpoint discovery may be fragile/private. |

## Critical Risks

### 1. Private Quota Endpoint Risk

Plan now depends on discovering Devin's quota endpoint with `mitmproxy` and calling it directly. This may be brittle or unacceptable depending on Devin's intended API surface.

Recommended policy:

```text
Phase 1 spike may inspect endpoint.
Implementation must support graceful fallback.
If endpoint is unstable/private-risky, V1 ships with finish_reason + manual override + auth status metadata only.
```

### 2. `finish_reason` Availability Risk

Plan assumes `finish_reason: quota_exhausted` can be observed by the runner. That may be true in some modes, but normal interactive `devin` output may not expose structured events.

Required Phase 1 validation:

```text
Run real `devin -p ...` and interactive session under wrapper.
Capture whether any machine-readable event includes finish_reason.
If not, downgrade structured signal to "only when available".
```

### 3. Default Strategy Drift

Original user goal emphasized round robin to avoid interruption. Updated plan defaults to `manual` with suggestions. This is safer but may not match desired workflow.

Decision needed:

```text
manual default vs quota-weighted default vs strict round-robin default
```

### 4. Session Output Retention

UI includes live tail and sessions. Raw output may include secrets, repo paths, prompts, or private code.

Recommended V1 default:

```text
No raw log persistence.
Only live redacted tail in memory.
Persist summary fields only.
Raw logs opt-in with TTL.
```

### 5. Local UI Token Handoff

Plan proposes opening browser with `?t=<one-shot-token>`. Query tokens can appear in browser history.

Safer V1:

```text
One-shot token expires in 60s.
Immediately exchange with POST /api/auth/exchange.
UI calls history.replaceState() to remove query.
Token stored in sessionStorage only.
```

## Recommended Plan Edits Before Cook

1. In Phase 1, add explicit decision gate after quota endpoint spike:
   - `server-quota-enabled`
   - `fallback-only`
2. In Phase 4, avoid saying ACP/finish_reason is guaranteed. Phrase as "structured signal when observable".
3. In Phase 5, specify one-shot token removal from URL.
4. In Phase 6, add a test that proves whether `finish_reason` is observable in each run mode.

## Validation Questions

### Q1. Private quota endpoint usage

Recommended: **Fallback-first with optional endpoint**

Options:

- **Fallback-first with optional endpoint (Recommended):** Implement endpoint polling only if Phase 1 proves stable and acceptable; otherwise finish_reason/manual override still ships.
- **Endpoint-first:** Treat quota polling as required; block implementation if endpoint cannot be used.
- **No private endpoint:** Avoid direct quota endpoint entirely; rely on observable CLI signals and manual controls.

### Q2. Default selection strategy

Recommended: **Quota-weighted default**

Options:

- **Quota-weighted default (Recommended):** Best "least interruption" behavior once quota snapshots exist; falls back to round-robin when unknown.
- **Manual default:** Safest and most user-controlled, but less automatic.
- **Strict round-robin default:** Matches original ask, but may choose low-quota accounts before high-quota accounts.

### Q3. Raw session logs

Recommended: **Live only, no raw persistence**

Options:

- **Live only, no raw persistence (Recommended):** UI streams redacted tail while running; DB stores summary only.
- **Persist redacted logs:** Better debugging, higher privacy risk.
- **Raw opt-in per session:** More flexible, but adds UI/settings complexity.

### Q4. V1 packaging

Recommended: **Local web app + CLI only**

Options:

- **Local web app + CLI only (Recommended):** Fastest route to reliable business logic.
- **Tauri from start:** More polished, slower and higher frontend/native surface.
- **CLI first, UI later:** Fastest core, but delays requested visual management.

## Recommendation

Proceed after user answers Q1-Q4. No blocker on profile isolation or database architecture.
