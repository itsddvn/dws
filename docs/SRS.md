# Software Requirements Specification - devin-switcher

**Version:** 1.3.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** PRD v1.3.0, BusinessRules v1.3.0, ARCHITECTURE v1.3.0
**Owner:** itsddvn

---

## 1. Introduction

### 1.1 Purpose
This SRS defines testable requirements for the `dsw` CLI. Requirements are extracted from the current README, source, and tests.

### 1.2 Scope
Scope mirrors PRD section 1.2: local account management, profile isolation, Devin subprocess execution, diagnostics, update behavior, and developer verification.

### 1.3 Definitions
See PRD section 1.4 for account, profile, ready account, LRU, and shared CLI state definitions.

### 1.4 References
- PRD v1.3.0
- BusinessRules v1.3.0
- ARCHITECTURE v1.3.0

## 2. Overall Description

### 2.1 Product Perspective
`dsw` is a local Node.js CLI that wraps the external `devin` binary and scopes Devin data/config homes by account profile. Components are defined in ARCHITECTURE section 5.

### 2.2 User Classes
- Local operator: runs commands and manages profiles.
- Maintainer: changes the CLI and runs release checks.

### 2.3 Operating Environment
- Node.js 20 or newer.
- `devin` binary available on `PATH` for real use.
- `tmux` available on `PATH` for `dsw quota`.
- Local filesystem supports directories, file permissions, rename, and symlinks.
- npm and git are required only for update workflows.

### 2.4 Constraints
- Single local operator model.
- No server, database engine, or API surface.
- Credentials are managed by the Devin CLI, not by `dsw`.
- `package.json` and the lock-file root package metadata are expected to match before release.

### 2.5 Assumptions
- Devin CLI respects XDG data/config environment variables.
- Operators do not intentionally run multiple mutating `dsw` commands against the same store concurrently.
- Fake Devin integration tests represent the consumed subset of Devin CLI behavior.

## 3. Functional Requirements

### 3.1 CLI (`FR-CLI-*`)

#### FR-CLI-001 Command Routing
**Statement:** System SHALL route known subcommands through `commander` and send missing or unknown top-level commands to default Devin execution.
**Input:** Process argv.
**Output:** Selected command handler or forwarded Devin args.
**Acceptance:** `dsw --help` lists supported commands; `dsw some forwarded args` forwards args to fake Devin.
**Components:** `C-01`.
**Related BR:** `BR-OPS-01`.

#### FR-CLI-002 Help and Version
**Statement:** System SHALL expose CLI help and version metadata for the `dsw` command.
**Input:** `--help`, `-h`, `--version`, or `-V`.
**Output:** Help text or version output.
**Acceptance:** Help integration test passes and includes all PRD commands; release verification checks CLI version output against `package.json`.
**Components:** `C-01`.
**Related BR:** `BR-OPS-01`.

### 3.2 Accounts (`FR-ACC-*`)

#### FR-ACC-001 Create Account Record
**Statement:** System SHALL create a unique account record with generated id, name, timestamps, empty auth metadata, and `needsLogin = true`.
**Input:** Account name.
**Output:** Persisted account in store.
**Acceptance:** Store unit test creates and rereads account.
**Components:** `C-02`.
**Related BR:** `BR-DATA-01`.

#### FR-ACC-002 List Account Records
**Statement:** System SHALL list accounts with name, readiness status, email, tier, plan, org id, and last-used time.
**Input:** `dsw list` or `dsw ls`.
**Output:** Terminal table or empty-state message.
**Acceptance:** Integration and list command behavior show records and empty state.
**Components:** `C-01`, `C-02`.
**Related BR:** `BR-OPS-01`.

#### FR-ACC-003 Update Auth Metadata
**Statement:** System SHALL store auth status metadata and clear `needsLogin` after successful login/status.
**Input:** Devin auth status fields.
**Output:** Account with email, tier, plan, org id, and `needsLogin = false`.
**Acceptance:** Store unit test updates auth metadata.
**Components:** `C-02`, `C-04`.
**Related BR:** `BR-AUTH-01`.

#### FR-ACC-004 Remove Account
**Statement:** System SHALL remove an account record and its profile directory only when `--yes` is supplied.
**Input:** Account name and remove confirmation option.
**Output:** Deleted account/profile or refusal message.
**Acceptance:** Integration test verifies removal and refusal without `--yes`.
**Components:** `C-01`, `C-02`, `C-03`.
**Related BR:** `BR-DATA-02`.

### 3.3 Authentication (`FR-AUTH-*`)

#### FR-AUTH-001 Add Account Login
**Statement:** System SHALL run `devin auth login` inside the new account profile during `dsw add`.
**Input:** Optional account name.
**Output:** Profile credentials written by Devin and auth metadata stored by `dsw`.
**Acceptance:** Integration add flow succeeds with fake Devin credentials.
**Components:** `C-03`, `C-04`.
**Related BR:** `BR-SEC-01`.

#### FR-AUTH-002 Re-login Existing Account
**Statement:** System SHALL run `devin auth login` for an existing account during `dsw login <name>`.
**Input:** Existing account name.
**Output:** Updated auth metadata or `needsLogin = true` on failure.
**Acceptance:** Integration test marks account as needs-login when fake login fails.
**Components:** `C-04`, `C-02`.
**Related BR:** `BR-AUTH-01`.

#### FR-AUTH-003 Infer Account Name
**Statement:** System SHALL infer an unnamed added account from auth status Name, falling back to email local-part.
**Input:** Devin auth status output.
**Output:** Slugged unique account name.
**Acceptance:** Integration tests cover Name and email fallback.
**Components:** `C-01`, `C-02`, `C-04`.
**Related BR:** `BR-DATA-01`.

### 3.4 Run Selection (`FR-RUN-*`)

#### FR-RUN-001 Quota-Aware Default Selection
**Statement:** System SHALL check quota before default `dsw [args...]` and select the ready account with the highest known remaining quota, using least-recently-used as the tie-breaker.
**Input:** Account list and per-account quota results.
**Output:** Selected account or no-eligible error.
**Acceptance:** Runner unit tests verify highest remaining quota, LRU tie-breaks, skipped login accounts, skipped exhausted accounts, and fallback when quota checks fail.
**Components:** `C-01`, `C-02`, `C-04`, `C-07`.
**Related BR:** `BR-AUTH-01`.

#### FR-RUN-002 Quota-Aware Next Selection
**Statement:** System SHALL check quota before `dsw next [args...]` and select the ready account with the highest known remaining quota.
**Input:** Account list and per-account quota results.
**Output:** Selected account or no-eligible error.
**Acceptance:** Integration tests verify `dsw next` checks all ready accounts and selects the account with maximum remaining quota.
**Components:** `C-01`, `C-02`, `C-04`, `C-07`.
**Related BR:** `BR-AUTH-01`.

#### FR-RUN-003 Forward Devin Arguments and Exit Code
**Statement:** System SHALL forward command args to `devin` and propagate its exit code.
**Input:** Remaining CLI args after `dsw` selection.
**Output:** `devin` invocation and matching exit code.
**Acceptance:** Integration tests show forwarded args for default, `next`, and `use`.
**Components:** `C-04`.
**Related BR:** `BR-OPS-01`.

#### FR-RUN-004 Direct Account Selection
**Statement:** System SHALL run Devin under the named ready account for `dsw use <name> [args...]`.
**Input:** Account name and optional Devin args.
**Output:** Devin invocation using that account profile, or an actionable error when the account needs login.
**Acceptance:** Integration test selects account `two`, forwards `-p hello`, and updates `lastUsedAt`.
**Components:** `C-01`, `C-02`, `C-04`.
**Related BR:** `BR-AUTH-01`, `BR-OPS-01`.

#### FR-RUN-005 Quota Reporting
**Statement:** System SHALL check quota for all managed ready accounts through `dsw quota`.
**Input:** Account list.
**Output:** Table with account status, tier, used percentage, remaining percentage, reset duration, and reset time when available.
**Acceptance:** Integration and unit tests parse Devin `/usage` output and skip accounts needing login; manual smoke test verifies real tmux-backed output.
**Components:** `C-01`, `C-02`, `C-04`, `C-07`.
**Related BR:** `BR-AUTH-01`, `BR-OPS-01`.

#### FR-RUN-006 Quota Cache
**Statement:** System SHALL cache quota summaries for automatic default and `next` selection, respect `DSW_QUOTA_CACHE_TTL_MS`, bypass quota checks when `DSW_SKIP_QUOTA=1`, refresh cache entries from `dsw quota`, and invalidate the selected account cache entry after a Devin run starts.
**Input:** Account list, quota cache file, `DSW_SKIP_QUOTA`, `DSW_QUOTA_CACHE_TTL_MS`.
**Output:** Fresh cached quota results, stale accounts to re-check, or LRU fallback when bypassed.
**Acceptance:** Quota cache unit tests cover persistence, freshness, TTL expiry, bypass behavior, corrupt cache tolerance, and entry invalidation.
**Components:** `C-02`, `C-07`.
**Related BR:** `BR-DATA-04`.

### 3.5 Profiles (`FR-PROF-*`)

#### FR-PROF-001 Profile Env Isolation
**Statement:** System SHALL set `XDG_DATA_HOME` and `XDG_CONFIG_HOME` to the selected profile before running Devin.
**Input:** Account id and app paths.
**Output:** Devin child env with profile paths.
**Acceptance:** Integration fake Devin prints profile-scoped `XDG_DATA_HOME`.
**Components:** `C-03`, `C-04`.
**Related BR:** `BR-SEC-01`.

#### FR-PROF-002 Shared CLI State Link
**Statement:** System SHALL link each profile `devin/cli` path to the shared user Devin CLI state.
**Input:** Profile paths and base env.
**Output:** Symlink or migrated symlink.
**Acceptance:** Profile runtime tests verify symlink and migration.
**Components:** `C-05`.
**Related BR:** `BR-DATA-03`.

#### FR-PROF-003 Config Sync Without Org Leak
**Statement:** System SHALL sync non-auth config while preserving profile and shared `devin.org_id` values in their own scopes.
**Input:** Shared and profile config JSON.
**Output:** Merged JSON without profile org id leak.
**Acceptance:** Profile runtime tests verify both directions.
**Components:** `C-05`.
**Related BR:** `BR-SEC-02`, `BR-DATA-03`.

#### FR-PROF-004 Path Overrides
**Statement:** System SHALL resolve `DSW_DATA_HOME` and `DSW_CONFIG_HOME` to absolute app paths.
**Input:** Process env.
**Output:** App paths with store and profile directories.
**Acceptance:** Paths unit tests cover defaults and overrides.
**Components:** `C-03`.
**Related BR:** `BR-DATA-01`.

#### FR-PROF-005 Read Profile Org ID
**Statement:** System SHALL read `devin.org_id` from profile config when present and return null for missing or malformed config.
**Input:** Profile config file.
**Output:** Org id string or null.
**Acceptance:** Profile config unit tests cover missing, malformed, and present config.
**Components:** `C-05`.
**Related BR:** `BR-SEC-02`.

### 3.6 Operations (`FR-OPS-*`)

#### FR-OPS-001 Doctor
**Statement:** System SHALL print app paths, profile path, account count, Devin CLI version detection, and tmux version detection.
**Input:** `dsw doctor`.
**Output:** Diagnostic report and warning if Devin or tmux is missing.
**Acceptance:** Integration test verifies fake Devin version output and tmux output.
**Components:** `C-01`, `C-04`, `C-07`.
**Related BR:** `BR-OPS-01`.

#### FR-OPS-002 Update
**Statement:** System SHALL update a git-linked install with `git pull --ff-only`, `npm install`, and `npm run build`, or update a package install with `npm install -g <name>@latest` when allowed.
**Input:** `dsw update` or `dsw update --dry-run`.
**Output:** Executed or printed update commands.
**Acceptance:** Integration test verifies dry-run local checkout commands.
**Components:** `C-01`.
**Related BR:** `BR-OPS-01`.

#### FR-OPS-003 Developer Checks
**Statement:** Maintainer SHALL have npm scripts for test, typecheck, lint, and build.
**Input:** npm scripts.
**Output:** Automated verification commands.
**Acceptance:** `package.json` defines all four scripts and they pass before release.
**Components:** `C-06`.
**Related BR:** `BR-OPS-02`.

#### FR-OPS-004 tmux Install Check
**Statement:** System SHALL run a best-effort tmux dependency checker during npm install.
**Input:** `npm install`, local PATH, platform package manager availability, `DSW_INSTALL_TMUX`, and `DSW_SKIP_TMUX_INSTALL`.
**Output:** tmux version confirmation, warning/manual install guidance, or opt-in automatic install attempt.
**Acceptance:** `node scripts/ensure-tmux.js` exits 0 and reports tmux on a machine with tmux installed.
**Components:** `C-06`, `C-07`.
**Related BR:** `BR-OPS-01`, `BR-OPS-02`.

#### FR-OPS-005 Package Publication
**Statement:** System SHALL publish as `@itsddvn/dsw`, expose `dsw` through package `bin`, build from `tsconfig.build.json`, and include only runtime package files in npm pack output.
**Input:** `package.json`, `package-lock.json`, `tsconfig.build.json`, `npm pack --dry-run`.
**Output:** Installable npm package with `bin/dsw` resolving to `dist/src/cli/index.js`.
**Acceptance:** Package and lock root metadata match, package file list is runtime-only, and global install exposes `dsw`.
**Components:** `C-01`, `C-06`.
**Related BR:** `BR-OPS-04`.

## 4. Non-Functional Requirements

### 4.1 Performance (`NFR-PERF-*`)

#### NFR-PERF-001 Startup Latency
System SHOULD complete account selection and child process spawn without intentional sleeps. Acceptance: no production code sleeps and integration tests finish within 30 seconds.

### 4.2 Reliability (`NFR-REL-*`)

#### NFR-REL-001 Atomic Store Writes
System SHALL write account store and quota cache updates through a temporary file followed by rename. Acceptance: atomic-write unit tests pass and `AccountStore` / quota cache use `atomicWriteJsonSync`.

#### NFR-REL-002 Recoverable Login Failure
System SHALL leave explicit-name login failures recoverable through `dsw login <name>`. Acceptance: integration test marks failed login account as needs-login.

#### NFR-REL-003 Corrupt Cache Tolerance
System SHALL ignore a missing or malformed quota cache file without preventing account selection. Acceptance: quota-cache unit test for corrupt cache passes.

### 4.3 Security (`NFR-SEC-*`)

#### NFR-SEC-001 Profile Credentials
System SHALL create profile data/config directories with restrictive permissions where supported. Acceptance: directory creation uses mode `0o700`; credential writes in tests use `0o600`.

#### NFR-SEC-002 Sensitive Output Redaction
System SHALL redact JWT-like strings, Devin session tokens, authorization fields, API/access keys, `windsurf_api_key`, and standalone Bearer tokens in captured external CLI output. Acceptance: redaction unit tests pass.

### 4.4 Usability (`NFR-USE-*`)

#### NFR-USE-001 Actionable Errors
System SHOULD tell the operator which command to run when no accounts exist, no eligible accounts exist, remove lacks `--yes`, or login needs retry. Acceptance: command messages include corrective command text.

### 4.5 Maintainability (`NFR-MAINT-*`)

#### NFR-MAINT-001 Verification Suite
System SHALL keep unit and integration tests under `tests/**/*.spec.ts` and run them with Vitest. Acceptance: `npm test` passes.

#### NFR-MAINT-002 Strict TypeScript
System SHALL keep TypeScript strict mode and `noUncheckedIndexedAccess` enabled. Acceptance: `tsconfig.json` includes both settings and `npm run typecheck` passes.

### 4.6 Compatibility (`NFR-COMPAT-*`)

#### NFR-COMPAT-001 Node Compatibility
System SHALL require Node.js 20 or newer. Acceptance: `package.json` declares `engines.node >=20`.

#### NFR-COMPAT-002 tmux Availability
System SHALL require tmux for quota reporting. Acceptance: `postinstall` checks tmux and `dsw doctor` reports tmux status.

### 4.7 Observability (`NFR-OBS-*`)

#### NFR-OBS-001 Terminal Diagnostics
System SHALL provide `dsw doctor` as the primary diagnostic surface. Acceptance: doctor prints local paths, Devin detection, and tmux detection.

## 5. Out of Scope

- Predictive quota forecasting or direct Devin API quota reads.
- Web UI, route map, or visual design system.
- Database engine, DDL, migrations, indexes, or SQL role policy.
- Public/internal HTTP API.
- Live calls to real Devin in automated tests.
- Concurrent multi-process store locking.

## 6. Acceptance Bars

| Bar | Target | Source |
|-----|--------|--------|
| CLI behavior | All integration tests pass. | `tests/integration/cli.spec.ts` |
| Core logic | All unit tests pass. | `tests/unit/*.spec.ts` |
| Type safety | `npm run typecheck` exits 0. | `package.json:33` |
| Lint | `npm run lint` exits 0. | `package.json:34` |
| Build | `npm run build` emits runtime `dist/src`. | `package.json:27`, `tsconfig.build.json:1` |
| Package | `npm pack --dry-run` includes runtime files only. | `package.json:16` |

---

## Traceability

| FR/NFR | Upstream PRD Feature | Related BR |
|--------|----------------------|------------|
| `FR-CLI-001` | `F4` | `BR-OPS-01` |
| `FR-CLI-002` | `F6` | `BR-OPS-01` |
| `FR-ACC-001` | `F1`, `F2` | `BR-DATA-01` |
| `FR-ACC-002` | `F1` | `BR-OPS-01` |
| `FR-ACC-003` | `F2` | `BR-AUTH-01` |
| `FR-ACC-004` | `F3` | `BR-DATA-02` |
| `FR-AUTH-001` | `F2` | `BR-SEC-01` |
| `FR-AUTH-002` | `F2` | `BR-AUTH-01` |
| `FR-AUTH-003` | `F2` | `BR-DATA-01` |
| `FR-RUN-001` | `F4` | `BR-AUTH-01` |
| `FR-RUN-002` | `F4` | `BR-AUTH-01` |
| `FR-RUN-003` | `F4` | `BR-OPS-01` |
| `FR-RUN-004` | `F4` | `BR-AUTH-01`, `BR-OPS-01` |
| `FR-RUN-005` | `F4.1` | `BR-AUTH-01`, `BR-OPS-03` |
| `FR-RUN-006` | `F4` | `BR-DATA-04` |
| `FR-PROF-001` | `F5` | `BR-SEC-01` |
| `FR-PROF-002` | `F5` | `BR-DATA-03` |
| `FR-PROF-003` | `F5` | `BR-SEC-02`, `BR-DATA-03` |
| `FR-PROF-004` | `F5` | `BR-DATA-01` |
| `FR-PROF-005` | `F5` | `BR-SEC-02` |
| `FR-OPS-001` | `F6` | `BR-OPS-01` |
| `FR-OPS-002` | `F6` | `BR-OPS-01` |
| `FR-OPS-003` | `F6` | `BR-OPS-02` |
| `FR-OPS-004` | `F6` | `BR-OPS-03` |
| `FR-OPS-005` | `F6` | `BR-OPS-04` |
| `NFR-PERF-001` | `F4` | none |
| `NFR-REL-001` | `F1` | `BR-DATA-01` |
| `NFR-REL-002` | `F2` | `BR-AUTH-01` |
| `NFR-REL-003` | `F4` | `BR-DATA-04` |
| `NFR-SEC-001` | `F5` | `BR-SEC-01` |
| `NFR-SEC-002` | `F2` | `BR-SEC-02` |
| `NFR-USE-001` | `F1`-`F6` | `BR-OPS-01` |
| `NFR-MAINT-001` | `F6` | `BR-OPS-02` |
| `NFR-MAINT-002` | `F6` | `BR-OPS-02` |
| `NFR-COMPAT-001` | `F6` | none |
| `NFR-COMPAT-002` | `F4.1`, `F6` | `BR-OPS-03` |
| `NFR-OBS-001` | `F6` | `BR-OPS-01` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-07 | itsddvn | Initial SRS extraction from README, source, and tests. |
| 1.1.0 | 2026-05-07 | itsddvn | Added direct account selection, quota reporting, tmux install check, and tmux diagnostics requirements. |
| 1.2.0 | 2026-05-07 | itsddvn | Added quota-aware default and next account selection requirements. |
| 1.3.0 | 2026-05-07 | itsddvn | Added quota cache, package publication, tmux opt-in install, and expanded redaction requirements. |
