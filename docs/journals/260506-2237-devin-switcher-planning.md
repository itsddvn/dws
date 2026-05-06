---
title: "Devin Switcher Planning"
created: 2026-05-06
plan: plans/260506-2237-devin-switcher-tool
---

# Devin Switcher Planning

## Context

User wants a local app to manage multiple legitimate Devin CLI accounts, track 5h/week quota, and round-robin accounts without workflow interruption.

## What Happened

- Researched Devin CLI local behavior.
- Confirmed Devin respects `XDG_DATA_HOME` for credential pathing.
- Compared CLIProxyAPI routing model.
- Chose profile sandbox runner over proxy router and global credential replacement.
- Created research report and implementation plan.
- **Revision (same day):** inspected `devin 2026.5.5-0` binary symbols; discovered Devin uses server-side credit/ACU quota with daily AND weekly windows, structured `finish_reason: quota_exhausted`, and a dedicated quota fetch endpoint reachable via `windsurf-api-client`. Initial plan's local-timer assumption was wrong.
- Captured findings in `reports/research-addendum-quota-model.md`.
- Reviewed plan with user; collected decisions on UI stack, selection strategy, quota detection.
- Rewrote `plan.md`, `phase-01`, `phase-04`; touched `phase-02/03/05/06` for consistency.

## Decisions

- V1 execution uses isolated XDG profiles. (unchanged)
- V1 does not implement custom API proxy. (unchanged)
- **V1 quota source is server-authoritative** (poll quota endpoint per profile) with `finish_reason` and string fallbacks. Local timer is no longer the primary signal.
- **V1 supports three selection strategies** with a CLI flag: `quota-weighted` (default), `manual`, `round-robin`.
- **UI stack locked**: TypeScript + Node 20 + SQLite + React SPA served by the same Node process on `127.0.0.1`. Tauri deferred.
- Phase 1 includes a **mitmproxy spike** to capture the exact quota endpoint and produce a contract document.
- First-run wizard imports the existing global credential as Profile #1.
- Per-profile locks; concurrent sessions across profiles allowed.
- Effort estimate revised from 22h to 60h.

## Next

- Review revised Phase 1 design.
- Approve final stack, schema, CLI contract, and selection semantics.
- Run mitmproxy spike to lock quota endpoint.
- Then implement foundation and business logic phases.
