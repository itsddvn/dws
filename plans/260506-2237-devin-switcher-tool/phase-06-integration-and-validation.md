# Phase 6: Integration And Validation

## Context Links

- [Plan Overview](./plan.md)
- [Research Report](./reports/research-report.md)
- [Research Addendum: Quota Model](./reports/research-addendum-quota-model.md)
- [Selection And Quota Logic](./phase-04-round-robin-and-quota-logic.md)

## Overview

Priority: P1
Status: Automated validation complete; live/manual validation pending
Goal: prove end-to-end correctness with the real Devin CLI. Validate profile isolation, selection behavior, quota source, structured limit detection, lock recovery, and UI flows.

## Requirements

- Real Devin CLI integration on macOS.
- Profile isolation invariant: global credential bytes unchanged through all flows.
- Quota endpoint normalization verified against a recorded contract fixture; live endpoint verification remains manual because the endpoint is private and optional in V1.
- Limit detection via structured `finish_reason` proven in a controlled run.
- Structured signal observability proven per Devin run mode (`-p`, interactive, `acp`) or explicitly downgraded to output fallback for that mode.
- Crashed-session lock recovery proven.
- UI flows match CLI flows.
- Usage docs that a new user can follow without reading any source.

## Architecture

Test layers:

```text
unit tests
  -> integration tests with tmp XDG dirs and a fake `devin` shim
  -> live tests against real `devin` CLI (gated, `DSW_LIVE=1`)
  -> manual validation checklist
  -> UI smoke test (API-level; Playwright/browser smoke deferred until Playwright is added)
```

Fake `devin` shim:

- A small script printing predetermined ACP events / lines and exiting with controlled codes. Used to deterministically test limit detection paths without burning real quota.

## Related Code Files

Create/modify:

- `/Users/itsddvn/projects/devin-switcher/tests/integration/profiles.spec.ts`
- `/Users/itsddvn/projects/devin-switcher/tests/integration/scheduler.spec.ts`
- `/Users/itsddvn/projects/devin-switcher/tests/integration/runner.spec.ts`
- `/Users/itsddvn/projects/devin-switcher/tests/integration/quota.spec.ts`
- `/Users/itsddvn/projects/devin-switcher/tests/live/devin-real.spec.ts` (gated)
- `/Users/itsddvn/projects/devin-switcher/tests/ui/smoke.spec.ts` (API-level UI smoke)
- `/Users/itsddvn/projects/devin-switcher/scripts/fake-devin.ts`
- `/Users/itsddvn/projects/devin-switcher/scripts/manual-validation.md`
- `/Users/itsddvn/projects/devin-switcher/docs/usage.md`

## Implementation Steps

1. Add a fake `devin` shim with selectable scenarios (`completed`, `quota_exhausted`, `auth_required`, `rate_limited_then_completed`, `crash`).
2. Write integration tests using tmp XDG dirs and the shim:
   - Profile env builder produces correct paths.
   - `auth status` parser handles missing logins gracefully.
   - Scheduler eligibility honors all filter conditions.
   - Each strategy picks the expected account from fixture sets.
   - Round-robin cursor wraps and persists.
   - Lock acquired and released; stale lock cleaned by next operation.
   - `finish_reason: quota_exhausted` flips status to `limited` and triggers an immediate poll.
   - Run-mode matrix documents whether `finish_reason` is observable in `-p`, interactive, and `acp`.
   - `Turn limit reached` does NOT flip status.
   - `Rate limited:` is recorded as cooldown event but status stays `ready`.
3. Add a quota endpoint contract test using a recorded mitm fixture (do not hit live server in CI).
4. Add migration test: open old DB, apply migrations, assert schema.
5. Live tests (gated by env var) using two real Devin profiles:
   - Require both profiles to already exist and be logged in.
   - Run auth-status checks against each profile.
   - Run `dsw run primary -- -p 'echo hi'` and assert the session row records a successful exit.
   - Confirm sha256 of `~/.local/share/devin/credentials.toml` unchanged across all live tests.
6. UI smoke covers: login required, accounts list renders, manual mark-limited round-trip, settings save. Current automated coverage is API-level; browser-level Playwright coverage is deferred until Playwright is added as a project dependency.
7. Manual validation checklist (`scripts/manual-validation.md`) for items hard to script: real OAuth login, browser opens, Ctrl+C handling.
8. Write `docs/usage.md` covering install, first-run wizard, `add`, `run`, `next`, `mark-limited`, `ui`, common errors.

## Todo List

- [x] Fake devin shim.
- [x] Profile integration tests.
- [x] Scheduler integration tests.
- [x] Runner integration tests with shim scenarios.
- [x] Quota endpoint contract test from fixture.
- [x] Migration test.
- [x] Live test suite implemented and gated by `DSW_LIVE=1`.
- [ ] Live test suite executed on maintainer machine.
- [x] UI smoke test (API-level).
- [x] Manual validation checklist.
- [x] Usage docs.

## Validation Results

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass, with live tests skipped unless `DSW_LIVE=1`.
- `npm run build`: pass.

Automated validation covers profile env isolation, auth-status parsing, scheduler eligibility, quota-weighted and round-robin selection, cursor persistence, stale lock cleanup, structured `finish_reason` handling, output fallback handling, terminal redaction, quota fixture normalization, migration application, protected UI API flows, manual mark-limited round-trip, browser-opener error handling, and settings persistence.

Live validation remains gated by `DSW_LIVE=1` and requires pre-authenticated real profiles. Manual OAuth, browser UI behavior, interactive run-mode observability, and hard process kill handling are still pending and tracked in `scripts/manual-validation.md`.

## Success Criteria

- All non-live tests pass on a clean clone.
- Live tests pass on the maintainer's machine with two real Devin accounts.
- After full live run, sha256 of global credential file matches pre-run value.
- Round robin skips a profile that hit `quota_exhausted` in a previous run.
- Manual `mark-limited` from UI is honored by `dsw next`.
- Stale lock created by killing a running `dsw run` is cleaned within 120 seconds (or earlier via `dsw doctor`).
- A new user can complete the workflow "install → wizard → add second account → run with `dsw next`" using only `docs/usage.md`.

## Risk Assessment

- **Triggering real `quota_exhausted` is hard to reproduce on demand.** Mitigation: rely on shim for automated coverage; use manual override + monitoring in live tests.
- **OAuth login flake** in tests. Mitigation: live login is manual-only; never automated.
- **Endpoint signature drift across Devin versions.** Mitigation: Phase 1 spike output + contract test fixture must be re-recorded when bumping target Devin version. `dsw doctor` warns when fixture-vs-live divergence is detected.

## Security Considerations

- Confirm 0700/0600 perms after every test run (test enforces).
- Confirm logs and UI bodies redact JWT in snapshot tests.
- Confirm server refuses connections from non-loopback (binding test).
- Confirm token middleware blocks missing-token requests with HTTP 401.

## Next Steps

After validation, optionally package as Tauri desktop in a follow-up plan. V1 is shipped when this phase passes.
