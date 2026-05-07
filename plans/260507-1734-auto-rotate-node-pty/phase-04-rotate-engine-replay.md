# Phase 4 - Implement Rotate Engine And Replay

## Context Links

- [Plan](./plan.md)
- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)

## Overview

Priority: P1  
Status: Completed  
Goal: implement automatic and manual account rotation inside the PTY runner.

## Key Insights

- Auto trigger must confirm quota through hidden PTY before rotating.
- Manual `:rotate` skips quota confirm.
- Prompt replay is best-effort, single-line only.

## Requirements

- Create `src/core/output-watcher.ts`.
- Create `src/core/input-interceptor.ts`.
- Create `src/core/prompt-capture.ts`.
- Create `src/core/rotate-engine.ts`.
- Integrate these into `pty-runner.ts`.
- Implement single-flight mutex and debounce.
- Select replacement account by quota.

## Architecture

```text
PTY output -> output watcher -> auto trigger
stdin bytes -> input interceptor -> manual trigger or pass-through
stdin bytes -> prompt capture -> safe replay candidate
trigger -> rotate engine -> confirm/select/kill/spawn/resume/replay
```

## Related Code Files

| File | Action | Notes |
|---|---|---|
| `/Users/itsddvn/projects/devin-switcher/src/core/output-watcher.ts` | Create | Detect quota/rate-limit signatures. |
| `/Users/itsddvn/projects/devin-switcher/src/core/input-interceptor.ts` | Create | Raw stdin parser for `:rotate`. |
| `/Users/itsddvn/projects/devin-switcher/src/core/prompt-capture.ts` | Create | Safe prompt replay candidate tracking. |
| `/Users/itsddvn/projects/devin-switcher/src/core/rotate-engine.ts` | Create | Rotation orchestration. |
| `/Users/itsddvn/projects/devin-switcher/src/core/pty-runner.ts` | Modify | Wire events and restart process. |
| `/Users/itsddvn/projects/devin-switcher/tests/unit/*` | Add/modify | Unit tests for watcher/interceptor/capture. |
| `/Users/itsddvn/projects/devin-switcher/tests/integration/*` | Add/modify | Fake auto/manual rotate flows. |

## Implementation Steps

1. Implement ANSI-stripping output watcher with tight regex and debounce keying.
2. Implement raw input parser for start-of-line `:rotate` and escaped `\:rotate`.
3. Implement prompt capture for simple submitted single-line prompts only.
4. Implement rotate engine with single-flight guard.
5. Auto path: hidden PTY quota confirm; rotate only when remaining <= threshold.
6. Manual path: skip confirm; require session id; pick replacement.
7. Kill current Devin: Ctrl+C, grace, terminate, kill; emit alt-screen cleanup.
8. Spawn replacement with `devin -r <session-id>`.
9. Replay safe prompt or print resend message.

## Todo List

- [x] Add watcher tests.
- [x] Add interceptor tests.
- [x] Add prompt capture tests.
- [x] Add rotate engine tests.
- [x] Add integration tests for fake exhaustion/manual rotate.

## Success Criteria

- False-positive quota wording with remaining > threshold does not rotate.
- Exhausted quota rotates to replacement account and resumes session.
- `:rotate` rotates manually.
- `\:rotate` reaches Devin as literal input.
- Unsafe prompt replay is skipped with clear message.

## Risk Assessment

- Risk: raw input parser brittle.
- Mitigation: small state machine, narrow trigger, unit tests for CR/backspace/paste/escape.

## Security Considerations

- Do not replay prompts unless captured safely.
- Do not print raw secrets from Devin output.

## Next Steps

Proceed to docs and full verification.
