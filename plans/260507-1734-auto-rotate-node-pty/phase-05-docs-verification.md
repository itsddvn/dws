# Phase 5 - Update Docs And Verification

## Context Links

- [Plan](./plan.md)
- [Auto-Rotate Design](../../docs/AUTO_ROTATE_DESIGN.md)

## Overview

Priority: P1  
Status: Completed  
Goal: align public docs, product docs, packaging, doctor output, and tests with node-pty-only quota/rotate behavior.

## Key Insights

- Repo scan shows stale `dsw next` and tmux references across docs/tests/source.
- Done means docs and tests are cleaned up, not just code.
- `node-pty` is optional; docs need clear fallback behavior.

## Requirements

- Remove `dsw next` references from README and product docs.
- Remove tmux as a requirement from README, doctor, postinstall, package files, and product docs.
- Update external docs/tech stack to node-pty.
- Update tests and fake Devin comments away from tmux assumptions.
- Document that `dsw next` is removed and guarded with a clear error.
- Document PTY-unavailable behavior for default run and `dsw quota`.
- Keep or remove `scripts/ensure-tmux.js` according to final implementation policy; if kept, mark legacy/debug only and remove postinstall.

## Related Code Files

| File | Action | Notes |
|---|---|---|
| `/Users/itsddvn/projects/devin-switcher/README.md` | Modify | Commands, env vars, requirements. |
| `/Users/itsddvn/projects/devin-switcher/package.json` | Modify | Remove tmux postinstall/files if obsolete. |
| `/Users/itsddvn/projects/devin-switcher/scripts/ensure-tmux.js` | Delete or demote | No normal runtime dependency. |
| `/Users/itsddvn/projects/devin-switcher/src/cli/commands/doctor.ts` | Modify | Report node-pty/Devin, not tmux requirement. |
| `/Users/itsddvn/projects/devin-switcher/docs/*.md` | Modify | PRD/SRS/Use cases/Architecture/Roadmap/Tech stack/Test cases. |
| `/Users/itsddvn/projects/devin-switcher/tests/integration/cli.spec.ts` | Modify | Doctor/help/command behavior. |

## Implementation Steps

1. Update README requirements and command table.
2. Update doctor output and tests.
3. Remove tmux postinstall from package metadata.
4. Update docs: PRD, SRS, USECASES, ARCHITECTURE, ROADMAP, TESTCASES, TECHSTACK, EXTERNAL_DOCS, BUSINESS_RULES.
5. Remove stale `dsw next` test cases.
6. Add/verify docs for removed `next` error behavior and PTY-unavailable behavior.
7. Run repo-wide `rg` for `dsw next` and tmux; only historical/changelog mentions may remain if clearly marked.
8. Run full verification.

## Todo List

- [x] Update user docs.
- [x] Update product docs.
- [x] Update doctor/package.
- [x] Update tests.
- [x] Run `rg` cleanup scans.
- [x] Run full verification.

## Success Criteria

- `rg "dsw next"` shows no active command docs/tests.
- `rg "tmux"` shows no active runtime requirement.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes.

## Risk Assessment

- Risk: broad docs update creates drift.
- Mitigation: update docs in one phase after behavior is stable; use repo-wide scans.

## Security Considerations

- Docs must accurately describe credential/profile isolation and redaction.
- Doctor must not expose credentials or sensitive env values.

## Next Steps

Ready for release/commit after verification.
