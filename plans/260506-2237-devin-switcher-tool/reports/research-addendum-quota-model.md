---
title: "Devin Quota Model Addendum"
description: "Correction to initial quota assumption: Devin uses credits/ACU with daily+weekly quotas, not session hours. Reverse-engineered from local binary symbols."
created: 2026-05-06
supersedes: none
extends: research-report.md
sources: [local-devin-binary, devin-auth-status, windsurf-api-client-crate]
---

# Devin Quota Model Addendum

## Context

Initial research-report recommended local session timer + output pattern matching as quota strategy. Binary symbol inspection of `/Users/itsddvn/.local/bin/devin` (`devin 2026.5.5-0`) revealed the real server-side quota model is richer and structured, which changes the selection and enforcement strategy.

## Server-Side Quota Model

`PlanStatus` struct exposed by server (strings extracted from binary):

```text
used_prompt_credits
available_prompt_credits
used_flow_credits
available_flow_credits
used_flex_credits
available_flex_credits
daily_quota_remaining_percent
weekly_quota_remaining_percent
daily_quota_reset_at_unix
weekly_quota_reset_at_unix
overage_balance_micros
grace_period_status
top_up_status
was_reduced_by_orphaned_usage
plan_start
```

Key implications:

- Quota is credit/ACU based, not time based.
- Both daily AND weekly windows exist; plan tier decides which binds.
- Reset is server-authoritative (absolute unix timestamp).
- Credit consumption rate depends on model and workload, not elapsed wall time.

## Per-Session Cost Fields

Chat message metadata includes:

```text
committed_credit_cost
committed_acu_cost
creditCost
acuCost
cognition.ai/acuUsed
```

And session `finish_reason` values include:

```text
quota_exhausted
auth_required
max_turn_requests
cancelled
interrupted
completed
tool_rejected
```

So quota exhaustion is a structured exit signal, not a best-effort string scrape.

## REPL Commands Referencing Quota

```text
/usage    Show session usage of credits / ACUs
/upgrade  Upgrade your subscription plan
```

Associated runtime strings:

```text
Fetching quota
Credits:
ACUs:
No quota data available.
Timed out fetching quota data.
Quota used:
Quota resets
Quota exhausted:
Rate limited:
Upgrade your plan or wait for your quota to reset
Turn limit reached
```

Note: `Turn limit reached` is per-conversation, not quota exhaustion. Do not treat as limited.

## Auth Surface And Endpoint Hints

- `api_server_url` defaults to `https://server.codeium.com`.
- Known path fragments in binary: `/v3/self`, `/v3/organizations/`, `/v3beta1/organizations/`, `/api/health`.
- HTTP client crate: `windsurf-api-client`.
- Auth header: JWT in `windsurf_api_key` (credential file key).
- `auth status` prints tier/plan but does not print quota percentages; the `/usage` REPL path performs a separate fetch.

## Plan Tiers Observed

```text
DevinFree, DevinTrial, DevinTeams, DevinTeamsV2, DevinEnterprise
Pro, Teams, Ultimate, ProUltimate, EnterpriseSaas, EnterpriseSelfHosted
EnterpriseSelfServe, EnterpriseSaasPooled, Waitlist, Hybrid, Unspecified
```

Implication: quota UX must be tier-agnostic. Display whatever server provides.

## Recommended Quota Strategy For V1

Layered, degrade gracefully:

1. **Primary:** call the same quota endpoint Devin's `/usage` path calls, using the profile's JWT, at a low poll rate (e.g. every 2–5 min and on session end). Store remaining % + reset timestamps.
2. **Secondary (reliable):** parse `finish_reason: quota_exhausted` at session end to mark profile limited immediately, even if poll hasn't fired.
3. **Tertiary (defensive):** string match on known messages (`"Quota exhausted"`, `"Upgrade your plan or wait for your quota to reset"`) from stdout. Treat `"Rate limited:"` as short cooldown, not exhaustion.
4. **Fallback:** local session timer + manual override when server endpoint changes.

Do not rely solely on local time accumulation. It will mis-count for idle/interactive sessions.

## Spike Required In Phase 1

Before committing to primary path, capture the exact quota endpoint:

```bash
# intercept HTTPS traffic from Devin
mitmdump -s scripts/capture-quota.py \
  --set block_global=false \
  --listen-host 127.0.0.1 --listen-port 8080

HTTPS_PROXY=http://127.0.0.1:8080 SSL_CERT_FILE=~/.mitmproxy/mitmproxy-ca-cert.pem \
devin auth status
# then run devin, trigger /usage in REPL
```

Deliverable: path + method + request shape + response shape documented in Phase 1 technical design.

If endpoint cannot be used (unstable, TLS pinned, or ToS concern), downgrade primary to `finish_reason` + manual override.

## Selection Strategy Implications

With accurate remaining %, selection can use:

- `manual` — user picks, UI shows suggested best.
- `quota-weighted` — pick profile with highest `min(daily_remaining, weekly_remaining)` above reserve threshold.
- `round-robin` — stable cursor across eligible profiles.

Default V1 after validation: `quota-weighted`, falling back to round-robin when quota snapshots are unknown. Flag `--strategy quota|rr|manual`.

## Concurrency Note

XDG isolation allows two Devin processes in parallel (different profiles). Whether to allow this is a policy choice:

- Per-profile lock: concurrent-across-accounts OK.
- Global single-active lock: one Devin at a time.

V1 recommendation: per-profile lock. Interactive UX rarely runs two, but locking it out preempts no real user need.

## Out-Of-Scope Clarification

- `devin cloud` sessions: consume separate cloud quota, lifecycle managed by Devin server. V1 does not track.
- Cross-account session resume (`/resume`): session IDs are scoped per account; do not attempt cross-profile resume.
- MCP and per-profile `config.json` settings will also isolate per profile. Document this as expected behavior, not a bug.
