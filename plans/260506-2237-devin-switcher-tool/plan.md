---
title: "Devin Switcher Tool"
description: "Local-first manager for multiple Devin CLI accounts with isolated XDG profiles, quota-aware selection, and a thin local web UI."
status: in_progress
priority: P2
effort: 60h
issue:
branch:
tags: [feature, frontend, backend, database, auth]
blockedBy: []
blocks: []
created: 2026-05-06
updated: 2026-05-06
---

# Devin Switcher Tool

## Overview

Local-first tool to manage multiple legitimate Devin accounts on one workstation. Each account runs inside its own XDG data/config sandbox, so `devin` never needs to rewrite the global credential file. The tool tracks quota signals, flags exhausted accounts, and picks the next account to use via one of three strategies (manual, quota-weighted, strict round-robin).

V1 is single-user, single-host, localhost-bound. Not a proxy. Not a cloud service.

## Cross-Plan Dependencies

No active unfinished plans found in `plans/`.

## Context Links

- [Research Report](./reports/research-report.md) — initial profile isolation findings.
- [Research Addendum: Quota Model](./reports/research-addendum-quota-model.md) — corrected quota semantics (credits/ACU, daily/weekly, structured finish_reason).

## Design Decisions

### 1. Isolated XDG Profile Runner (unchanged)

Primary execution model:

```bash
XDG_DATA_HOME=~/.local/share/devin-switcher/profiles/<account>/data \
XDG_CONFIG_HOME=~/.local/share/devin-switcher/profiles/<account>/config \
devin ...
```

Rationale:

- Devin CLI respects `XDG_DATA_HOME` for credential resolution (verified).
- No global credential replacement.
- Supports concurrent sessions across profiles.
- Account state stays isolated.

### 2. Quota Source Is Server, Not A Timer

Devin's server exposes structured `PlanStatus` (daily/weekly remaining %, reset timestamps, credits/ACU counters). Per-session `finish_reason` includes `quota_exhausted`. Local time accumulation does not reflect real ACU consumption because cost varies per model and per workload.

V1 quota strategy is fallback-first and layered:

```text
Primary:   mark limited from structured finish_reason when observable
Secondary: string-match known limit messages from stdout/stderr
Optional:  poll server quota endpoint only after Phase 1 spike approval
Manual:    mark/unmark overrides
```

Phase 1 includes a spike to capture the exact endpoint via `mitmproxy`.

### 3. Selection Strategy Is Configurable, Default Quota-Weighted

V1 supports three strategies, switchable per run:

- `quota-weighted` (default) — pick profile with highest `min(daily_remaining_pct, weekly_remaining_pct)` above reserve; fall back to round-robin when quota is unknown.
- `manual` — user picks, UI/CLI shows a suggested account.
- `quota-weighted` — pick profile with highest `min(daily_remaining_pct, weekly_remaining_pct)` above reserve.
- `round-robin` — stable cursor across eligible profiles.

All strategies filter by the same eligibility predicate: enabled AND not limited AND not locked AND login valid.

### 4. UI Is A Thin Local Web App

Backend: Node + TypeScript service, SQLite persistence, bound to `127.0.0.1`. Frontend: single-page app served by the same process. Launched by `dsw ui` subcommand. Tauri packaging deferred to V2.

### 5. Wrapper CLI Is Transparent

```text
dsw run <profile> -- <any devin args>
dsw next -- <any devin args>
```

Everything after `--` is passed through to `devin` unchanged. The CLI sets XDG env, records a session row, streams output, and parses finish signals.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Product And Technical Design](./phase-01-product-and-technical-design.md) | Completed |
| 2 | [Project Foundation](./phase-02-project-foundation.md) | Completed |
| 3 | [Profile And Credential Management](./phase-03-profile-and-credential-management.md) | Completed |
| 4 | [Selection And Quota Logic](./phase-04-round-robin-and-quota-logic.md) | Completed |
| 5 | [Local UI Dashboard](./phase-05-local-ui-dashboard.md) | Partially Completed |
| 6 | [Integration And Validation](./phase-06-integration-and-validation.md) | Automated Complete; Live Pending |

## Scope

### In scope (V1)

- Multi-profile account manager via XDG isolation.
- First-run wizard that imports the existing global credential as Profile #1.
- Transparent wrapper CLI (`dsw`) that launches `devin` under a chosen profile.
- Three selection strategies: manual / quota-weighted / round-robin.
- Fallback-first quota handling with structured finish_reason when observable, pattern fallback, manual override, and optional server-side quota polling after spike approval.
- Per-profile concurrent session support with per-profile locks.
- Local web UI at `http://127.0.0.1:<port>` for accounts, quota, sessions, manual overrides.
- Manual mark-limited, mark-needs-login, enable/disable.
- SQLite persistence with append-only event log.
- Redaction of JWT and credential contents in logs and UI.

### Out of scope (V1)

- API proxy / OpenAI-compatible routing.
- Global credential replacement as primary flow.
- Token rewriting, mid-session credential switching.
- Devin Cloud session tracking (`devin cloud ...`).
- Cross-profile session resume.
- Multi-user / multi-host deployment.
- Automatic plan upgrade or billing actions.
- Tauri desktop packaging (deferred).

## Dependencies

- `devin` CLI installed locally (tested against `devin 2026.5.5-0`).
- Node 20+ and TypeScript.
- SQLite (via `better-sqlite3` or `node:sqlite` — decided in Phase 2).
- `mitmproxy` on dev machine for the Phase 1 quota endpoint spike only.
- macOS filesystem permissions for profile data (Linux support is a follow-up, not V1 requirement).

## Success Criteria

- User can add/manage multiple Devin profiles from CLI and UI.
- `dsw run <profile> -- <args>` and `dsw next -- <args>` launch `devin` with the correct XDG env and record a session row.
- Eligibility filter skips disabled, locked, limited, quota-exhausted, and needs-login profiles.
- On `finish_reason: quota_exhausted`, the profile is marked limited within seconds without any user action.
- Server quota poll populates daily/weekly remaining % and reset timestamps for active profiles when endpoint mode is enabled.
- UI shows per-profile tier, plan, daily/weekly remaining %, last error, active session, and last-selected cursor.
- Global `~/.local/share/devin/credentials.toml` is unchanged by any normal flow (only `dsw import-global` touches it — read-only copy).
- UI binds `127.0.0.1` only; credential bodies never appear in UI or logs.
- Per-profile lock prevents accidental double-start of the same profile; separate profiles can run in parallel.

## Open Questions

- Exact quota HTTP path and request shape. Deferred: endpoint optional; fallback-first mode until mitmproxy capture is available.
- Do daily and weekly quotas both apply to all tiers, or only to some? UI hides whichever the server omits.
- Retention policy for session output logs. Decision: live redacted tail only in V1; no raw output persistence.
- How to detect silent token expiry mid-session. Decision: `auth_required` when observable, 401 from endpoint if enabled, otherwise `devin auth status` checks and manual login CTA.

## Validation Log

### 2026-05-06 — Validation Session 1

Validation report: [Plan Validation Report](./reports/validation-report.md)

Status: recommended validation decisions accepted by `--auto`.

Confirmed:

- XDG profile isolation remains the correct primary architecture.
- API proxy/router remains out of scope for V1.
- Server quota model is more accurate than local time tracking.
- SQLite + local web UI + wrapper CLI is coherent for V1.

Decision points before implementation:

| Topic | Recommended Decision | Why |
|---|---|---|
| Private quota endpoint | Fallback-first with optional endpoint | Avoid hard dependency on reverse-engineered/private endpoint. |
| Default selector | Quota-weighted default | Better "least interruption" behavior than strict RR once quota snapshots exist. |
| Raw logs | Live redacted tail only, no raw persistence | Avoid storing sensitive prompts/code/secrets. |
| Packaging | Local web app + CLI only | Keeps V1 focused; Tauri can follow. |

Plan changes requested by validation:

- Phase 1 must include an explicit post-spike gate: endpoint polling enabled vs fallback-only.
- Phase 4 must treat `finish_reason` as available only if real runs expose it.
- Phase 5 must remove one-shot UI token from browser URL immediately after exchange.
- Phase 6 must test structured signal observability per run mode.
