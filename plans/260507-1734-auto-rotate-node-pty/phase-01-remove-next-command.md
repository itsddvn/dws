# Phase 1 - Remove Next Command

## Context Links

- [Plan](./plan.md)
- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)
- Current files: `src/cli/index.ts`, `src/cli/commands/next.ts`, `src/cli/commands/_shared.ts`

## Overview

Priority: P1  
Status: Completed  
Goal: remove the unused `dsw next` command before adding more routing complexity.

## Key Insights

- User explicitly confirmed no `dsw next` use case.
- Default `dsw` already performs quota-aware initial selection.
- Auto-rotate will cover mid-session exhaustion.

## Requirements

- Delete `src/cli/commands/next.ts`.
- Remove `runNext` import and `.command('next')` registration from `src/cli/index.ts`.
- Remove help examples and known-token surface for `next`.
- Add an explicit removed-command guard so `dsw next` prints a clear error and does not fall through to default Devin forwarding.
- Update shared comments from "default and next" to default-only.
- Preserve default unknown-args forwarding behavior.

## Architecture

Command routing after this phase:

```text
known command -> explicit command handler
removed command token -> clear removal error, no Devin spawn
unknown or no command -> runDefault({ args })
```

No `next` branch remains.

## Related Code Files

| File | Action | Notes |
|---|---|---|
| `/Users/itsddvn/projects/devin-switcher/src/cli/index.ts` | Modify | Remove import, help text, command registration. |
| `/Users/itsddvn/projects/devin-switcher/src/cli/commands/next.ts` | Delete | Command removed. |
| `/Users/itsddvn/projects/devin-switcher/src/cli/commands/_shared.ts` | Modify | Default-only comments/naming as needed. |
| `/Users/itsddvn/projects/devin-switcher/tests/integration/cli.spec.ts` | Modify | Remove/rewrite `next` specs. |

## Implementation Steps

1. Remove `runNext` import and command registration.
2. Delete `src/cli/commands/next.ts`.
3. Add removed-token check for `next` before default forwarding.
4. Rewrite integration tests so default `dsw` covers max-quota selection and forwarded args.
5. Add integration test that `dsw next` exits non-zero with removal message and does not invoke Devin.
6. Ensure help output no longer includes `next`.

## Todo List

- [x] Remove command code.
- [x] Add removed-token guard.
- [x] Update CLI help.
- [x] Update tests.
- [x] Run targeted integration tests.

## Success Criteria

- `dsw --help` no longer lists `next`.
- Running `dsw next` exits non-zero with clear removal message and does not spawn Devin.
- Existing default quota-aware selection tests pass.

## Risk Assessment

- Risk: unknown top-level `next` could become prompt text to Devin.
- Mitigation: reserve `next` as a removed token; tests assert no Devin invocation.

## Security Considerations

No new security surface. Removing a command reduces public CLI surface.

## Next Steps

Proceed to hidden PTY quota migration.
