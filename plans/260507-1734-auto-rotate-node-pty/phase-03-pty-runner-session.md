# Phase 3 - Add PTY Runner And Session Tracking

## Context Links

- [Plan](./plan.md)
- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)
- Current files: `src/core/runner.ts`, `src/cli/commands/default.ts`, `src/cli/commands/use.ts`

## Overview

Priority: P1  
Status: Completed  
Goal: add interactive PTY execution with defensive fallback and reliable session tracking.

## Key Insights

- `node-pty` import can pass while spawn fails; smoke spawn required.
- `devin list --format json` is validated as a session source.
- `runDevinForAccount` with `stdio: inherit` remains fallback and non-TTY path.

## Requirements

- Reuse `src/core/pty-loader.ts` from Phase 2.
- Create `src/core/pty-runner.ts`.
- Create `src/core/session-tracker.ts`.
- Route default interactive `dsw` through PTY runner when available.
- Route `dsw use <name>` through PTY runner with `autoRotate: false` when interactive.
- Preserve legacy runner for non-TTY and PTY unavailable.

## Architecture

```text
CLI command
  -> choose account
  -> if TTY and PTY enabled and node-pty smoke passes
       runDevinPtyForAccount({ autoRotate })
     else
       runDevinForAccount(...)
```

## Related Code Files

| File | Action | Notes |
|---|---|---|
| `/Users/itsddvn/projects/devin-switcher/src/core/pty-loader.ts` | Modify/reuse | Shared loader from Phase 2. |
| `/Users/itsddvn/projects/devin-switcher/src/core/pty-runner.ts` | Create | Main PTY forwarding runner. |
| `/Users/itsddvn/projects/devin-switcher/src/core/session-tracker.ts` | Create | Track session id from list/output. |
| `/Users/itsddvn/projects/devin-switcher/src/core/runner.ts` | Modify | Delegate/fallback boundary. |
| `/Users/itsddvn/projects/devin-switcher/src/cli/commands/default.ts` | Modify | Pass autoRotate true. |
| `/Users/itsddvn/projects/devin-switcher/src/cli/commands/use.ts` | Modify | Pass autoRotate false/manual only. |
| `/Users/itsddvn/projects/devin-switcher/tests/integration/pty-spike.spec.ts` | Extend | Runner-level coverage. |

## Implementation Steps

1. Reuse Phase 2 PTY loader and smoke-spawn result.
2. Implement PTY process spawn with profile env, cols/rows, SIGWINCH resize.
3. Forward stdin/stdout bidirectionally.
4. Track spawn/touchLastUsed and persist runtime on exit.
5. Implement session tracker using `devin list --format json` scoped to cwd; fallback parse output.
6. Add fallback warning for unavailable PTY.

## Todo List

- [x] Reuse shared PTY loader.
- [x] Add PTY runner.
- [x] Add session tracker.
- [x] Route default/use interactive paths.
- [x] Test fallback paths.

## Success Criteria

- Interactive fake Devin runs through PTY in tests.
- Non-TTY commands still use legacy runner.
- `DSW_DISABLE_PTY=1` forces legacy runner.
- Session tracker returns active session id or clear failure.

## Risk Assessment

- Risk: terminal state breaks on crash.
- Mitigation: cleanup alt-screen escapes and restore raw mode listeners in finally blocks.

## Security Considerations

- Do not expose env secrets in logs.
- Redact captured output where stored or printed outside live TTY forwarding.

## Next Steps

Proceed to rotate engine and input/replay behavior.
