---
title: "Auto-Rotate Node PTY Implementation"
description: "Implement cross-platform Devin auto-rotate using node-pty, remove dsw next, and remove tmux as a runtime requirement."
status: completed
priority: P1
effort: 18h
issue:
branch: main
tags: [feature, cli, cross-platform]
blockedBy: []
blocks: []
created: 2026-05-07
---

# Auto-Rotate Node PTY Implementation

## Overview

Implement `docs/AUTO_ROTATE_DESIGN.md` v0.6: default `dsw` runs through a defensive `node-pty` wrapper, detects quota exhaustion, confirms quota through a hidden PTY `/usage` probe, rotates to a replacement account, and resumes the active Devin session. Remove `dsw next` and remove tmux from the normal runtime surface.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
|---|---|---|
| None | No unfinished plans found under `plans/` | n/a |

## Source Design

- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)
- Current authority: validation Session 6 in the design doc.
- Superseded: earlier tmux-based validation notes in the design doc are historical only.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Remove Next Command](./phase-01-remove-next-command.md) | Completed |
| 2 | [Replace Tmux Quota With Hidden PTY](./phase-02-hidden-pty-quota.md) | Completed |
| 3 | [Add PTY Runner And Session Tracking](./phase-03-pty-runner-session.md) | Completed |
| 4 | [Implement Rotate Engine And Replay](./phase-04-rotate-engine-replay.md) | Completed |
| 5 | [Update Docs And Verification](./phase-05-docs-verification.md) | Completed |

## Dependencies

- `node-pty` optional dependency already added in current worktree.
- Real Devin CLI supports `devin list --format json`.
- Real cross-account resume smoke passed with `devin -r <session-id>`.
- Hidden PTY spike passed against fake Devin.

## Success Criteria

- `dsw next` is removed from CLI, docs, and tests.
- Invoking removed `dsw next` does not start Devin accidentally; it prints a clear removal error.
- `dsw quota` and default quota-aware selection use hidden `node-pty` probing, not tmux.
- `tmux` is not required by README, doctor, postinstall, product docs, or tests.
- Default interactive `dsw` uses PTY runner when available and legacy runner when unavailable.
- Auto-rotate confirms exhausted quota, selects replacement account, and resumes with `devin -r`.
- Manual `:rotate` works for simple raw input and escaped `\:rotate` passes through.
- Full verification passes: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Risks

| Risk | Mitigation |
|---|---|
| `node-pty` import works but spawn fails | Add shared loader with import + smoke-spawn check; fallback visibly. |
| Removed `dsw next` forwards into Devin as prompt text | Reserve removed token in CLI and print a clear error instead of default forwarding. |
| Hidden probe mutates shared config | Use no-runtime profile env; do not call `prepareProfileRuntime` or `persistProfileRuntime`. |
| Devin output format changes | Reuse parser warnings and keep raw redacted failure output for `dsw quota`. |
| Raw input parser eats user content | Match only start-of-line `:rotate`; support `\:rotate`; test paste/control cases. |
| Session ID unavailable | Use `devin list --format json` primary source and startup-output fallback; fail rotate clearly if absent. |

## Cook Handoff

Run from a fresh context:

```bash
$dex:cook --auto /Users/itsddvn/projects/devin-switcher/plans/260507-1734-auto-rotate-node-pty/plan.md
```

## Validation Log

### Session 1 - 2026-05-07

**Trigger:** `$dex:plan validate /plans/260507-1734-auto-rotate-node-pty/plan.md`
**Questions asked:** 5
**Interview note:** `AskUserQuestion` is not available in this environment, so this validation records recommended decisions directly.

#### Questions & Answers

1. **[Scope]** After removing `dsw next`, should `dsw next` be allowed to flow through the existing unknown-arg default path?
   - Options: Print a removed-command error (Recommended) | Forward to Devin as plain args | Keep a hidden alias
   - **Answer:** Print a removed-command error.
   - **Rationale:** Current router forwards unknown top-level args to Devin. Without a guard, removing the command could accidentally start Devin with `next` as user input.

2. **[Architecture]** Which phase should own the shared `node-pty` loader and smoke-spawn check?
   - Options: Phase 2 quota probe (Recommended) | Phase 3 PTY runner | Duplicate loader in both phases
   - **Answer:** Phase 2 quota probe.
   - **Rationale:** Hidden quota probing is the first feature that needs `node-pty`; putting the loader in Phase 2 avoids duplication and makes Phase 3 reuse it.

3. **[Risk]** What should default `dsw` do when hidden PTY quota probing is unavailable?
   - Options: Warn and fall back to LRU/legacy run behavior (Recommended) | Hard fail default run | Use stale cache silently
   - **Answer:** Warn and fall back to LRU/legacy run behavior.
   - **Rationale:** `node-pty` is optional and can fail to spawn on some systems. Default `dsw` should remain usable but must not pretend quota is known.

4. **[Risk]** What should `dsw quota` do when hidden PTY probing is unavailable?
   - Options: Exit non-zero with a clear PTY unavailable error (Recommended) | Fall back to stale cache | Use `devin --print /usage`
   - **Answer:** Exit non-zero with a clear PTY unavailable error.
   - **Rationale:** `dsw quota` is an explicit quota report. Returning stale or wrong account data would be misleading.

5. **[Docs/Tests]** Should historical tmux references remain?
   - Options: Only in clearly historical changelog/review contexts (Recommended) | Remove every occurrence | Keep current docs unchanged
   - **Answer:** Only in clearly historical changelog/review contexts.
   - **Rationale:** Active requirements must say node-pty, but old changelog entries can mention past tmux behavior if clearly historical.

#### Confirmed Decisions

- Add a removed-command guard for `next`; do not let it run Devin.
- Phase 2 owns the shared `node-pty` loader/smoke-spawn helper.
- Default `dsw` may warn and fall back to LRU/legacy run if PTY quota probing is unavailable.
- `dsw quota` should fail clearly if PTY quota probing is unavailable.
- Active docs must remove tmux as a requirement; historical references may remain only when explicitly historical.

#### Action Items

- [x] Add `next` removed-command guard in `src/cli/index.ts`.
- [x] Move/create `src/core/pty-loader.ts` in Phase 2 and reuse it in Phase 3.
- [x] Specify PTY-unavailable behavior separately for default run and `dsw quota`.
- [x] Keep repo-wide cleanup scans in Phase 5.

#### Impact on Phases

- Phase 1: add removed-token guard and tests.
- Phase 2: create reusable PTY loader and define quota-unavailable behavior.
- Phase 3: reuse Phase 2 loader instead of creating it.
- Phase 5: docs/tests must cover removed `next` behavior and PTY-unavailable behavior.

#### Recommendation

Proceed to cook after these plan corrections. The plan is coherent and has no cross-plan blockers.
