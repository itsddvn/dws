# Phase 2 - Replace Tmux Quota With Hidden PTY

## Context Links

- [Plan](./plan.md)
- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)
- Current files: `src/core/quota.ts`, `src/core/profile-env.ts`, `src/cli/commands/quota.ts`

## Overview

Priority: P1  
Status: Completed  
Goal: make quota probing cross-platform by replacing tmux with a hidden `node-pty` Devin REPL probe.

## Key Insights

- `devin --print /usage` is not correctness-safe for profile-specific quota reads.
- Hidden PTY spike passed in `tests/integration/pty-spike.spec.ts`.
- `prepareRuntime: false` already exists in current worktree; keep that no-runtime contract.

## Requirements

- Create `src/core/quota-pty-probe.ts`.
- Create shared `src/core/pty-loader.ts` with dynamic import and smoke-spawn check.
- Change `ReadQuotaOptions.transport` target to `auto | pty | print` or equivalent; remove tmux as default.
- Use hidden PTY for `dsw quota`, default quota selection, and rotate confirm.
- If PTY quota probing is unavailable, default `dsw` warns and falls back to LRU/legacy behavior; `dsw quota` exits non-zero with a clear error.
- Keep raw output redacted.
- Preserve timeout/error semantics.

## Architecture

```text
readQuotaForAccount
  -> account needs login? return needs-login
  -> build no-runtime profile env when using PTY probe
  -> quota-pty-probe spawns hidden devin
  -> send /usage
  -> capture quota signal
  -> parseQuotaSummary
  -> cleanup PTY
```

## Related Code Files

| File | Action | Notes |
|---|---|---|
| `/Users/itsddvn/projects/devin-switcher/src/core/pty-loader.ts` | Create | Shared dynamic import + smoke-spawn helper. |
| `/Users/itsddvn/projects/devin-switcher/src/core/quota-pty-probe.ts` | Create | Hidden PTY probe. |
| `/Users/itsddvn/projects/devin-switcher/src/core/quota.ts` | Modify | Route default quota reads to PTY. |
| `/Users/itsddvn/projects/devin-switcher/src/core/profile-env.ts` | Modify/keep | Keep no-runtime env helper. |
| `/Users/itsddvn/projects/devin-switcher/tests/unit/quota.spec.ts` | Modify | Replace tmux transport tests with PTY/no-runtime tests. |
| `/Users/itsddvn/projects/devin-switcher/tests/integration/cli.spec.ts` | Modify | Quota tests should not require tmux. |
| `/Users/itsddvn/projects/devin-switcher/scripts/fake-devin.ts` | Modify | Keep fake interactive `/usage` and session output. |

## Implementation Steps

1. Implement shared PTY loader with dynamic import and smoke-spawn check.
2. Extract `quotaResult`, quota signal detection, and parse helpers as needed.
3. Implement PTY probe with bounded startup wait, `/usage\r`, signal detection, cleanup.
4. Route `readQuotaForAccount` default to PTY.
5. Remove tmux availability check from quota path.
6. Implement PTY-unavailable behavior: default run warns/falls back; quota command fails clearly.
7. Update tests to use fake Devin PTY instead of tmux mocks.

## Todo List

- [x] Implement shared `pty-loader.ts`.
- [x] Implement `quota-pty-probe.ts`.
- [x] Replace default transport.
- [x] Remove tmux default behavior.
- [x] Update unit and integration tests.
- [x] Verify no quota test requires tmux.

## Success Criteria

- `dsw quota` works with fake Devin without tmux.
- Default `dsw` quota selection works with fake Devin without tmux.
- `transport: 'tmux'` tests are gone or marked legacy-only.
- PTY-unavailable default run and quota command behavior are covered.
- Timeout/error/needs-login behavior remains covered.

## Risk Assessment

- Risk: hidden PTY readiness heuristics flaky.
- Mitigation: detect quota signals, support startup delay env, test with fake Devin and bounded timeout.

## Security Considerations

- Do not log unredacted Devin output.
- Do not write shared config from hidden probe.
- No credential copying outside profile paths.

## Next Steps

Proceed to PTY runner and session tracking.
