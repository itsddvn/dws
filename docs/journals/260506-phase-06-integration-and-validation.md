# Phase 6 Integration And Validation

Implemented Phase 6 validation scaffolding and documentation.

Changes:

- Added `scripts/fake-devin.ts` with deterministic completion, quota exhaustion, auth-required, cooldown, turn-limit, ACP-style, and crash scenarios.
- Added integration tests for runner signal handling, quota polling after structured exhaustion, cooldown behavior, stale lock cleanup, auth parser missing-login behavior, scheduler eligibility, round-robin cursor persistence, quota fixture normalization, and migration application.
- Added a gated live test suite under `tests/live` for real Devin profile validation with `DSW_LIVE=1`.
- Added API-level UI smoke coverage for protected routes, account rendering, manual mark-limited, settings persistence, and browser-opener error handling.
- Fixed review gaps by redacting runner terminal streams before writing, making browser launch failures non-fatal, and keeping gated live tests read-only with respect to profile creation.
- Fixed final review gaps by buffering runner output by complete lines, bounding newline-free output with a redacted placeholder, redacting persisted command summaries, and returning HTTP 409 for UI runs when no account is eligible.
- Added `scripts/manual-validation.md` and `docs/usage.md`.
- Updated run-mode observability notes and marked automated Phase 6 validation complete while leaving live/manual validation pending.

Verification:

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass, with live tests skipped by default.
- `npm run build`: pass.
