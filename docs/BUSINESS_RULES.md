# Business Rules - devin-switcher

**Version:** 1.1.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** PRD v1.1.0
**Owner:** itsddvn

---

## 1. Purpose

Business rules define durable product policy for local account switching, credential isolation, profile deletion, and release discipline.

## 2. Categories

| Code | Name | Scope |
|------|------|-------|
| BR-AUTH | Authentication | Devin login/status delegation and account readiness. |
| BR-SEC | Security | Credential isolation and sensitive output handling. |
| BR-DATA | Data | Local account metadata and profile filesystem policy. |
| BR-OPS | Operations | Update, diagnostics, and release verification. |

## 3. Rules

### BR-AUTH-01 Ready Accounts Only

**Statement:** System SHALL only run Devin with accounts where `needsLogin` is false.
**Rationale:** Accounts requiring login cannot be trusted to execute a Devin session successfully.
**Enforcement Point:** `pickNextAccount` and `pickNextAccountInList` filters.
**Violation Behavior:** Command prints "No eligible accounts" when all accounts need login.
**Related:** `FR-RUN-001`, `FR-RUN-002`, PRD section 4.4.

### BR-SEC-01 Credential Isolation

**Statement:** System SHALL keep Devin credentials inside per-account profile data directories.
**Rationale:** Switching accounts by overwriting global credentials risks cross-account leakage.
**Enforcement Point:** `buildProfileEnv` sets profile-scoped XDG paths before spawning Devin.
**Violation Behavior:** Incorrect env construction is a release-blocking defect.
**Related:** `FR-PROF-001`, `FR-AUTH-001`, `NFR-SEC-001`, PRD section 4.5.

### BR-SEC-02 Profile Org ID Preservation

**Statement:** System SHALL NOT copy a profile-specific `devin.org_id` into the shared Devin config.
**Rationale:** Org identity is account-specific auth metadata.
**Enforcement Point:** `syncProfileConfigToShared` removes profile org id before merge.
**Violation Behavior:** Tests fail; release must not proceed.
**Related:** `FR-PROF-003`, `NFR-SEC-002`, PRD section 4.5.

### BR-DATA-01 Account Name Uniqueness

**Statement:** Account names MUST be non-empty, unique, and contain only letters, numbers, underscores, and dashes.
**Rationale:** Names are command arguments and must be stable identifiers.
**Enforcement Point:** `validateAccountName` in `AccountStore`.
**Violation Behavior:** Account creation or rename throws an error.
**Related:** `FR-ACC-001`, PRD section 4.1.

### BR-DATA-02 Confirmed Removal

**Statement:** System MUST NOT remove an account or profile directory unless the operator passes `--yes`.
**Rationale:** Removal deletes local credential files and should be explicit.
**Enforcement Point:** `runRemove` option check.
**Violation Behavior:** Command exits with error and prints the required confirmation syntax.
**Related:** `FR-ACC-004`, PRD section 4.3.

### BR-DATA-03 Shared Non-Auth Settings

**Statement:** System SHALL copy non-auth shared Devin settings into profiles and persist non-auth profile changes back to shared config.
**Rationale:** Account rotation should not fragment normal Devin CLI settings.
**Enforcement Point:** `prepareProfileRuntime` and `persistProfileRuntime`.
**Violation Behavior:** Profile runtime tests fail.
**Related:** `FR-PROF-002`, `FR-PROF-003`, PRD section 4.5.

### BR-OPS-01 User-Recoverable Errors

**Statement:** Operator-facing errors SHOULD name the command that resolves the condition when a known recovery exists.
**Rationale:** CLI failures should be actionable without documentation lookup.
**Enforcement Point:** Command handler error messages.
**Violation Behavior:** Usability regression tracked in tests or review.
**Related:** `NFR-USE-001`, PRD section 6.

### BR-OPS-02 Release Gate

**Statement:** Maintainer MUST run typecheck, lint, tests, and build before declaring a release ready.
**Rationale:** The CLI touches credentials and subprocess behavior; regressions need automated gates.
**Enforcement Point:** Release checklist.
**Violation Behavior:** Release remains Draft/Review.
**Related:** `FR-OPS-003`, `NFR-MAINT-001`, PRD section 6.

### BR-OPS-03 Quota Automation Dependency

**Statement:** System SHALL surface tmux availability before quota checks are needed and SHALL clean up quota tmux sessions after use.
**Rationale:** Quota reporting depends on interactive terminal automation and must not leave stale sessions behind.
**Enforcement Point:** `scripts/ensure-tmux.js`, `dsw doctor`, and `checkAccountQuota` session cleanup.
**Violation Behavior:** Missing tmux is reported by install/doctor; quota account failures are shown in the quota table.
**Related:** `FR-RUN-005`, `FR-OPS-001`, `FR-OPS-004`, `NFR-COMPAT-002`, PRD section 4.1.

## 4. Conflict Resolution

| Rule A | Rule B | Winner | Reason |
|--------|--------|--------|--------|
| `BR-SEC-01` | `BR-DATA-03` | `BR-SEC-01` | Credential isolation outranks config convenience. |
| `BR-DATA-02` | `BR-OPS-01` | `BR-DATA-02` | Data deletion must stay explicit even if shorter UX is possible. |

## 5. Traceability - SRS to BR

| SRS ID | BR IDs |
|--------|--------|
| `FR-ACC-001` | `BR-DATA-01` |
| `FR-ACC-004` | `BR-DATA-02` |
| `FR-AUTH-001` | `BR-SEC-01` |
| `FR-RUN-001` | `BR-AUTH-01` |
| `FR-RUN-002` | `BR-AUTH-01` |
| `FR-RUN-004` | `BR-AUTH-01`, `BR-OPS-01` |
| `FR-RUN-005` | `BR-AUTH-01`, `BR-OPS-03` |
| `FR-PROF-001` | `BR-SEC-01` |
| `FR-PROF-002` | `BR-DATA-03` |
| `FR-PROF-003` | `BR-SEC-02`, `BR-DATA-03` |
| `FR-OPS-004` | `BR-OPS-03` |
| `NFR-SEC-001` | `BR-SEC-01` |
| `NFR-SEC-002` | `BR-SEC-02` |
| `NFR-USE-001` | `BR-OPS-01` |
| `NFR-MAINT-001` | `BR-OPS-02` |
| `NFR-COMPAT-002` | `BR-OPS-03` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added quota automation and tmux dependency operating rules. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial business rules extraction from current behavior. |
