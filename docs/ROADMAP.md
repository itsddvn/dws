# Roadmap - devin-switcher

**Version:** 1.2.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** PRD v1.2.0, SRS v1.2.0, TECHSTACK v1.1.0, ARCHITECTURE v1.2.0, TESTCASES v1.2.0
**Owner:** itsddvn

---

## 1. Today and Targets

- **Today:** 2026-05-07.
- **Alpha target:** 2026-05-07.
- **Beta target:** 2026-05-08.
- **GA target:** 2026-05-10.

## 2. Milestones

### M0 Initial switcher (completed)

**Window:** 2026-05-06 -> 2026-05-06.
**Goal:** Create the local `dsw` account switcher foundation.
**Workstreams:**
- CLI: initialize binary, command routing, and store.
- Tests: add validation suite.
**Deliverables:**
- `bin/dsw`, `src/`, `tests/`.
**Hard Exit Gate (all must pass):**
- [x] Initial CLI command path exists.
- [x] Tests cover core behavior.

### M1 Account workflow (completed)

**Window:** 2026-05-06 -> 2026-05-07.
**Goal:** Complete account management commands and LRU rotation.
**Workstreams:**
- Commands: add, list, remove, login, next, doctor, update.
- Runtime: account store and profile env.
**Deliverables:**
- Account workflow in `src/cli/commands/`.
- Store and runner logic in `src/core/`.
**Hard Exit Gate (all must pass):**
- [x] Add/list/remove/login integration tests pass.
- [x] LRU fallback and quota-aware selection tests pass.

### M2 Shared runtime and config sync (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Share non-auth Devin runtime while preserving profile-specific auth metadata.
**Workstreams:**
- Profile runtime: symlink shared `devin/cli`.
- Config sync: merge non-auth settings without org id leakage.
**Deliverables:**
- `src/core/profile-runtime.ts`.
- `tests/unit/profile-runtime.spec.ts`.
**Hard Exit Gate (all must pass):**
- [x] Shared CLI state symlink tests pass.
- [x] Org id preservation tests pass.

### M3 Product documentation extraction (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Create source-backed product docs for the current codebase.
**Workstreams:**
- Docs: PRD, tech stack, architecture, business rules, SRS, use cases, test cases, roadmap, external docs.
- Verification: repo checks and doc coverage scan.
**Deliverables:**
- `docs/*.md`.
**Hard Exit Gate (all must pass):**
- [ ] Included docs have required headers and change logs.
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- [ ] Known lock-file root version drift is recorded.

### M4 Direct account and quota reporting (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Add direct named-account execution, all-account quota reporting, and quota-aware automatic selection.
**Workstreams:**
- CLI: add `dsw use <name>` and `dsw quota`.
- Runtime: automate interactive `/usage` through tmux under each profile env and use parsed quota to avoid exhausted automatic-run candidates.
- Tests: fake interactive Devin, quota parser, and command coverage.
**Deliverables:**
- `src/cli/commands/use.ts`.
- `src/cli/commands/quota.ts`.
- `src/core/quota.ts`.
**Hard Exit Gate (all must pass):**
- [x] Direct account command selects the named ready account.
- [x] Quota command skips needs-login accounts and reports per-account usage.
- [x] Default and next execution check quota before selecting an account.
- [x] tmux-backed real smoke test returns account quota rows.

### M5 tmux dependency packaging and docs (completed)

**Window:** 2026-05-07 -> 2026-05-07.
**Goal:** Make the quota terminal dependency visible and easier to install.
**Workstreams:**
- Installer: add best-effort tmux postinstall check.
- Diagnostics: include tmux in `dsw doctor`.
- Docs: update product docs and README.
**Deliverables:**
- `scripts/ensure-tmux.js`.
- Doctor tmux diagnostics.
- Updated `docs/*.md` and `README.md`.
**Hard Exit Gate (all must pass):**
- [x] `node scripts/ensure-tmux.js` succeeds on a machine with tmux.
- [x] `dsw doctor` prints tmux status.
- [x] Product docs reflect quota and tmux scope.

### M6 Package metadata cleanup (future)

**Window:** 2026-05-08 -> 2026-05-08.
**Goal:** Resolve package metadata drift and prepare release confidence.
**Workstreams:**
- Manifests: refresh `package-lock.json` root version from `package.json`.
- Release: re-run verification and update docs if behavior changes.
**Deliverables:**
- Updated lock file if approved.
**Hard Exit Gate (all must pass):**
- [ ] `package-lock.json` root package version matches `package.json` or drift is consciously accepted.
- [ ] Full verification suite passes.

## 3. ASCII Timeline

```text
2026-05-06       2026-05-07       2026-05-08       2026-05-10
|--M0--|--M1--|--M2--|--M3--|--M4--|--M5--|--M6--|
 done    done    done    docs    quota  tmux   cleanup
```

## 4. Critical Path

1. M0 CLI foundation -> unblocked M1 account workflow.
2. M1 account workflow -> unblocked M2 runtime sharing.
3. M2 runtime sharing -> unblocked M3 accurate architecture and SRS extraction.
4. M3 docs -> unblocked M4 quota scope update.
5. M4 quota reporting -> unblocked M5 tmux packaging and docs.
6. M5 dependency packaging -> unblocks M6 metadata cleanup.

## 5. Workstream Allocation

| Stream | Owner | M0 | M1 | M2 | M3 | M4 | M5 | M6 |
|--------|-------|----|----|----|----|----|----|----|
| Product/docs | itsddvn | support | support | support | lead | support | lead | review |
| CLI/runtime | itsddvn | lead | lead | lead | support | lead | lead | support |
| Tests/release | itsddvn | lead | lead | lead | lead | lead | lead | lead |

## 6. Risk vs Schedule

| Risk | Likelihood | Schedule Impact | Mitigation | Owner |
|------|------------|-----------------|------------|-------|
| Lock-file version drift causes release confusion. | High | Low | Fix in M4 or record exception. | itsddvn |
| Devin interactive `/usage` output changes. | Medium | Medium | Keep parser tests small and fail per account without stopping full quota scan. | itsddvn |
| tmux install is unavailable on a target OS. | Medium | Low | Print manual install guidance and make doctor warning explicit. | itsddvn |
| Real Devin CLI output diverges from fake shim. | Medium | Medium | Use `dsw doctor` and manual smoke test before release. | itsddvn |

## 7. Release Plan

| Tag | Milestone | Date | Audience |
|-----|-----------|------|----------|
| 0.3.0 | Current package version | 2026-05-07 | local/internal |
| 0.4.0 | M4/M5 account use, quota reporting, and tmux dependency handling | 2026-05-07 | local/internal |
| 0.4.1 | M6 metadata cleanup | 2026-05-08 | local/internal |

## 8. Cadence

- Per change: run typecheck, lint, tests, and build.
- Per docs update: update change logs and traceability.
- Before release: verify package manifest/lock metadata, command help, and fake Devin integration suite.

## 9. Glossary

| Term | Definition |
|------|------------|
| Alpha | Current local/internal usable state. |
| GA | Release state after docs and verification gates pass. |
| Lock drift | Mismatch between `package.json` and `package-lock.json` metadata. |

## 10. Source-of-Truth Hierarchy

When docs disagree, this order wins:

1. **PRD** - what we build - Included.
2. **TECHSTACK** - what we build it with - Included.
3. **ARCHITECTURE** - how the parts fit - Included.
4. **BusinessRules** - why - Included.
5. **SRS** - testable requirements - Included.
6. **UseCases** - actor interactions - Included.
7. **UserFlows** - N/A, not applicable for this CLI archetype.
8. **SITEMAP** - N/A, no UI routes.
9. **DESIGN** - N/A, no visual design system.
10. **Database** - N/A, persistence is JSON file storage, not a DB engine.
11. **API_REFERENCE** - N/A, no exposed API.
12. **TESTCASES** - verification - Included.
13. **ROADMAP** - when - Included.
14. **EXTERNAL_DOCS** - external APIs, specs, resources consumed - Included.

Lower-numbered doc wins ties. Update upstream first.

---

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Updated roadmap for completed direct account selection, quota reporting, and tmux dependency packaging. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial roadmap extracted from git history, current code, and user decisions. |
| 1.2.0 | 2026-05-07 | itsddvn | Updated roadmap to include quota-aware automatic selection. |
