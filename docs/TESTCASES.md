# Test Cases - devin-switcher

**Version:** 1.4.0
**Date:** 2026-05-08
**Status:** Active
**Source:** SRS v1.4.0, USECASES v1.4.0, `tests/`
**Owner:** itsddvn

---

## 1. Purpose

This document maps requirements and use cases to executable Vitest test cases. Existing tests are catalogued with their source files.

## 2. Conventions

- IDs use `TC-{CAT}-{NNN}`.
- Type is `unit`, `integration`, `manual`, `perf`, or `security`.
- Priority is `P0`, `P1`, or `P2`.

## 3. Test Environment

| Env | Purpose | Data | Reset between runs |
|-----|---------|------|--------------------|
| local | Unit and integration development | Temporary sandbox dirs | yes |
| ci | Release/merge gate | Temporary sandbox dirs | yes |

Tooling: `TS-TEST-05` Vitest and `TS-TEST-06` tsx. Integration tests use a fake `devin` shim and never touch real credentials.

## 4. Fixtures & Test Data

| Fixture | Path | Purpose | Owner |
|---------|------|---------|-------|
| Sandbox helper | `tests/helpers/sandbox.ts` | Creates temp data/config roots and app paths. | `C-06` |
| Fake Devin | `scripts/fake-devin.ts` | Simulates `devin --version`, auth login/status, forwarded invocations, and interactive `/usage`. | `C-06` |

Forbidden in tests: real Devin credentials, live external API calls, persistent writes outside sandbox paths.

## 5. Test Case Index

| ID | Title | Type | Priority | Related FR/NFR/UC | Status |
|----|-------|------|----------|-------------------|--------|
| `TC-CLI-001` | Help and version list supported metadata | integration | P0 | `FR-CLI-002` | Implemented |
| `TC-ACC-001` | Store creates, lists, updates, removes accounts | unit | P0 | `FR-ACC-001`, `FR-ACC-003`, `FR-ACC-004` | Implemented |
| `TC-ACC-002` | CLI add-list-remove flow | integration | P0 | `FR-ACC-002`, `FR-ACC-004`, `UC-ACC-01`, `UC-ACC-02` | Implemented |
| `TC-ACC-003` | Account name validation and slugging | unit | P1 | `FR-ACC-001`, `FR-AUTH-003`, `BR-DATA-01` | Implemented |
| `TC-AUTH-001` | Add unnamed account infers name | integration | P1 | `FR-AUTH-003`, `UC-AUTH-02` | Implemented |
| `TC-AUTH-002` | Login failure marks needs-login | integration | P0 | `FR-AUTH-002`, `UC-AUTH-03`, `NFR-REL-002` | Implemented |
| `TC-RUN-001` | Quota-aware default selector behavior | unit | P0 | `FR-RUN-001`, `UC-RUN-01` | Implemented |
| `TC-RUN-002` | Quota-aware removed-command guard behavior | integration | P0 | `FR-RUN-002`, `UC-RUN-02` | Implemented |
| `TC-RUN-003` | CLI forwards Devin args | integration | P0 | `FR-RUN-003`, `UC-RUN-01`, `UC-RUN-02` | Implemented |
| `TC-RUN-004` | Specific account command forwards Devin args | integration | P0 | `FR-RUN-004`, `UC-RUN-03` | Implemented |
| `TC-RUN-005` | Quota cache persistence, TTL, bypass, and invalidation | unit | P0 | `FR-RUN-006`, `NFR-REL-003`, `UC-RUN-01`, `UC-RUN-02` | Implemented |
| `TC-RUN-006` | Rate-limit continue retries before account switching | unit | P0 | `FR-RUN-007`, `UC-RUN-01` | Implemented |
| `TC-PROF-001` | App path resolution | unit | P0 | `FR-PROF-004` | Implemented |
| `TC-PROF-002` | Profile runtime symlink and config sync | unit | P0 | `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` | Implemented |
| `TC-PROF-003` | Profile org id reader | unit | P1 | `FR-PROF-005` | Implemented |
| `TC-OPS-001` | Update dry-run prints local checkout steps | integration | P1 | `FR-OPS-002`, `UC-OPS-02` | Implemented |
| `TC-OPS-002` | Doctor reports paths, Devin version, and node-pty availability | integration | P1 | `FR-OPS-001`, `UC-OPS-01`, `NFR-OBS-001` | Implemented |
| `TC-OPS-003` | Quota checks ready accounts and skips needs-login accounts | integration | P0 | `FR-RUN-005`, `FR-OPS-004`, `UC-OPS-04`, `NFR-COMPAT-002` | Implemented |
| `TC-OPS-004` | Process capture helper handles output, timeout, and spawn failure | unit | P1 | `NFR-USE-001`, `NFR-OBS-001` | Implemented |
| `TC-SEC-001` | Redaction covers auth-like secrets | unit | P0 | `NFR-SEC-002` | Implemented |
| `TC-MAINT-001` | Typecheck, lint, test, build pass | manual | P0 | `FR-OPS-003`, `UC-OPS-03`, `NFR-MAINT-001`, `NFR-MAINT-002` | Implemented by commands |
| `TC-MAINT-002` | npm package metadata and tarball contents are release-ready | manual | P0 | `FR-OPS-005`, `UC-OPS-03` | Implemented by commands |
| `TC-REL-001` | Atomic JSON helper writes safely and tolerates malformed reads | unit | P0 | `NFR-REL-001` | Implemented |

## 6. Test Cases - Detail

### 6.1 CLI

#### `TC-CLI-001` Help and version list supported metadata

**Type:** integration
**Priority:** P0
**Related:** `FR-CLI-002`
**Component under test:** `C-01`
**Preconditions:** Test shim is on `PATH`.
**Test Data:** args `["--help"]`, `["--version"]`.
**Steps:**
1. Run CLI through `tsx`.
2. Capture stdout and exit code.
3. Assert exit code 0 and commands are present.
4. Run version output and compare to package version.
**Expected Result:** Help includes `list`, `add`, `remove`, `login`, `use`, `quota`, `update`, and `doctor`; version output is `0.4.8`.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Tracks the supported command surface.

### 6.2 ACC

#### `TC-ACC-001` Store creates, lists, updates, removes accounts

**Type:** unit
**Priority:** P0
**Related:** `FR-ACC-001`, `FR-ACC-003`, `FR-ACC-004`, `BR-DATA-01`
**Component under test:** `C-02`
**Preconditions:** Sandbox paths exist.
**Test Data:** names `primary`, `one`, `two`, invalid names.
**Steps:**
1. Create account and reread store.
2. Reject duplicate and invalid names.
3. Update auth metadata.
4. Remove account and touch last-used.
**Expected Result:** Store behavior matches validation and persistence policy.
**Implementation:** `tests/unit/store.spec.ts:17`.
**Notes:** Also covers `NFR-REL-001` by exercising persisted writes.

#### `TC-ACC-002` CLI add-list-remove flow

**Type:** integration
**Priority:** P0
**Related:** `FR-ACC-002`, `FR-ACC-004`, `UC-ACC-01`, `UC-ACC-02`
**Component under test:** `C-01`, `C-02`, `C-03`, `C-04`
**Preconditions:** Fake Devin shim active.
**Test Data:** account `primary`.
**Steps:**
1. Run `dsw add primary`.
2. Run `dsw list`.
3. Run `dsw remove primary --yes`.
4. Run `dsw list`.
**Expected Result:** Account appears as ready, then empty-state appears after removal.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Removal refusal is covered at `tests/integration/cli.spec.ts`.

#### `TC-ACC-003` Account name validation and slugging

**Type:** unit
**Priority:** P1
**Related:** `FR-ACC-001`, `FR-AUTH-003`, `BR-DATA-01`
**Component under test:** `C-01`, `C-02`
**Preconditions:** None.
**Test Data:** valid names, whitespace, invalid characters, free-form auth names.
**Steps:**
1. Call `validateAccountName` with accepted and rejected names.
2. Call `slugifyAccountName` with mixed-case and punctuation inputs.
3. Assert slug output is valid or null when no usable characters exist.
**Expected Result:** Command-safe names are accepted; invalid names fail; auth display names become stable account slugs.
**Implementation:** `tests/unit/account-name.spec.ts:4`.
**Notes:** Supports named and unnamed account enrollment.

### 6.3 AUTH

#### `TC-AUTH-001` Add unnamed account infers name

**Type:** integration
**Priority:** P1
**Related:** `FR-AUTH-003`, `UC-AUTH-02`
**Component under test:** `C-01`, `C-02`, `C-04`
**Preconditions:** Fake Devin shim active.
**Test Data:** `DSW_FAKE_NAME=Jane Devin` and `DSW_FAKE_EMAIL=person@example.com`.
**Steps:**
1. Run `dsw add` with fake Name.
2. Assert slugged account is added.
3. Run `dsw add` with fake email fallback.
4. Assert local-part account is added.
**Expected Result:** Unnamed account receives stable inferred name.
**Implementation:** `tests/integration/cli.spec.ts`, `tests/integration/cli.spec.ts`.
**Notes:** Name uniqueness is handled by command helper.

#### `TC-AUTH-002` Login failure marks needs-login

**Type:** integration
**Priority:** P0
**Related:** `FR-AUTH-002`, `UC-AUTH-03`, `NFR-REL-002`
**Component under test:** `C-01`, `C-02`, `C-04`
**Preconditions:** Account `x` exists.
**Test Data:** `DSW_FAKE_FAIL_LOGIN=1`.
**Steps:**
1. Add account `x`.
2. Run `dsw login x` with fake login failure.
3. Run `dsw list`.
**Expected Result:** Exit code is 1 and list shows account `x` as `needs login`.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Protects recovery behavior.

### 6.4 RUN

#### `TC-RUN-001` Quota-aware default selector behavior

**Type:** unit
**Priority:** P0
**Related:** `FR-RUN-001`, `UC-RUN-01`
**Component under test:** `C-04` selection function
**Preconditions:** In-memory accounts.
**Test Data:** Ready, needs-login, exhausted, and quota-error accounts with different timestamps.
**Steps:**
1. Call `pickNextAccount` with timestamp variants.
2. Call `pickBestAccountByQuota` with different remaining percentages.
3. Call it with exhausted accounts and quota failures.
**Expected Result:** Highest remaining quota wins; LRU breaks quota ties; exhausted accounts are skipped; failed quota checks fall back to LRU.
**Implementation:** `tests/unit/runner-pick.spec.ts:20`.
**Notes:** Plain LRU behavior remains covered as the fallback path.

#### `TC-RUN-002` Removed command guard behavior

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-002`, `UC-RUN-02`
**Component under test:** `C-01`
**Preconditions:** Fake Devin shim active.
**Test Data:** `dsw next -p hello`.
**Steps:**
1. Add a ready account.
2. Run `dsw next -p hello`.
3. Capture stderr and stdout.
**Expected Result:** CLI exits non-zero with a removal error and fake Devin is not invoked.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** The guard prevents a removed command token from becoming prompt text.

#### `TC-RUN-003` CLI forwards Devin args

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-003`, `UC-RUN-01`
**Component under test:** `C-01`, `C-04`, `C-05`
**Preconditions:** Ready accounts exist.
**Test Data:** `some forwarded args`.
**Steps:**
1. Add accounts.
2. Set timestamps in store.
3. Run default command with unknown args.
**Expected Result:** Selected account is printed and fake Devin receives forwarded args.
**Implementation:** `tests/integration/cli.spec.ts`, `tests/integration/cli.spec.ts`.
**Notes:** Also validates profile-env path wiring indirectly.

#### `TC-RUN-004` Specific account command forwards Devin args

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-004`, `FR-RUN-003`, `UC-RUN-03`
**Component under test:** `C-01`, `C-04`, `C-05`
**Preconditions:** Ready accounts exist.
**Test Data:** `use two -p hello`.
**Steps:**
1. Add accounts `one` and `two`.
2. Run `dsw use two -p hello`.
3. Inspect stdout/stderr and store metadata.
**Expected Result:** CLI selects `two`, forwards `-p hello`, and updates `two.lastUsedAt`.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Verifies direct account selection bypasses rotation.

#### `TC-RUN-005` Quota cache persistence, TTL, bypass, and invalidation

**Type:** unit
**Priority:** P0
**Related:** `FR-RUN-006`, `NFR-REL-003`, `UC-RUN-01`, `UC-RUN-02`, `BR-DATA-04`
**Component under test:** `C-02`, `C-07`
**Preconditions:** Sandbox app data path exists.
**Test Data:** cached quota entries, stale/fresh timestamps, corrupt cache JSON, `DSW_SKIP_QUOTA`, `DSW_QUOTA_CACHE_TTL_MS`.
**Steps:**
1. Persist quota entries and read them back.
2. Split accounts into fresh and stale groups by TTL.
3. Verify TTL override and bypass env behavior.
4. Read corrupt cache content.
5. Invalidate one account cache entry.
**Expected Result:** Fresh entries are reused, stale entries are rechecked, corrupt cache is ignored, and invalidation removes only the selected account.
**Implementation:** `tests/unit/quota-cache.spec.ts:39`.
**Notes:** Covers local quota cache policy for default execution.

#### `TC-RUN-006` Rate-limit continue retries before account switching

**Type:** unit
**Priority:** P0
**Related:** `FR-RUN-007`, `UC-RUN-01`
**Component under test:** `C-04`
**Preconditions:** Fake PTY module and fake timers are active.
**Test Data:** Devin output containing "Rate limit exceeded" and session id `session-1`.
**Steps:**
1. Feed rate-limit output into the PTY runner.
2. Advance the retry delay.
3. Assert the first three triggers spawn `devin --continue`.
4. Feed a fourth rate-limit output.
5. Assert account rotation is invoked and resumes the tracked session.
**Expected Result:** Temporary rate limits retry through `devin --continue`; account switching happens only after three failed continue attempts.
**Implementation:** `tests/unit/output-watcher.spec.ts`, `tests/unit/pty-runner.spec.ts`, `tests/unit/rotate-engine.spec.ts`.
**Notes:** Prevents temporary tool-call rate limits from causing unnecessary account switches.

### 6.5 PROF

#### `TC-PROF-001` App path resolution

**Type:** unit
**Priority:** P0
**Related:** `FR-PROF-004`
**Component under test:** `C-03`
**Preconditions:** Env map provided.
**Test Data:** default home, relative `DSW_DATA_HOME`, `~/relative-config`.
**Steps:**
1. Resolve default paths.
2. Resolve explicit overrides.
**Expected Result:** Paths point to `.dsw` by default and overrides become absolute.
**Implementation:** `tests/unit/paths.spec.ts:5`.
**Notes:** DSW env wins over XDG env.

#### `TC-PROF-002` Profile runtime symlink and config sync

**Type:** unit
**Priority:** P0
**Related:** `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003`, `BR-SEC-01`, `BR-SEC-02`, `BR-DATA-03`
**Component under test:** `C-05`
**Preconditions:** Sandbox filesystem.
**Test Data:** shared and profile Devin config JSON.
**Steps:**
1. Prepare profile runtime.
2. Assert profile `devin/cli` is symlinked to shared state.
3. Migrate pre-existing isolated state.
4. Sync shared config to profile preserving profile org id.
5. Persist profile config to shared without leaking profile org id.
**Expected Result:** Shared runtime and org-id isolation policies hold.
**Implementation:** `tests/unit/profile-runtime.spec.ts:18`.
**Notes:** High-value credential isolation coverage.

#### `TC-PROF-003` Profile org id reader

**Type:** unit
**Priority:** P1
**Related:** `FR-PROF-005`, `BR-SEC-02`
**Component under test:** `C-05`
**Preconditions:** Profile dirs exist.
**Test Data:** missing config, malformed config, config with org id.
**Steps:**
1. Read missing config.
2. Read malformed config.
3. Read valid config with `devin.org_id`.
**Expected Result:** Missing/malformed return null; valid returns org id.
**Implementation:** `tests/unit/profile-config.spec.ts:8`.
**Notes:** Used after login to store org metadata.

### 6.6 OPS and SEC

#### `TC-OPS-001` Update dry-run prints local checkout steps

**Type:** integration
**Priority:** P1
**Related:** `FR-OPS-002`, `UC-OPS-02`
**Component under test:** `C-01`
**Preconditions:** Repo has `.git`.
**Test Data:** `update --dry-run`.
**Steps:**
1. Run dry-run update.
2. Capture stdout.
**Expected Result:** Output contains `git pull --ff-only`, `npm install`, and `npm run build`.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Does not mutate repo.

#### `TC-OPS-002` Doctor reports paths, Devin version, and node-pty availability

**Type:** integration
**Priority:** P1
**Related:** `FR-OPS-001`, `UC-OPS-01`, `NFR-OBS-001`
**Component under test:** `C-01`, `C-04`, `C-07`
**Preconditions:** Fake Devin shim active.
**Test Data:** `doctor`.
**Steps:**
1. Run `dsw doctor`.
2. Capture stdout and exit code.
**Expected Result:** Output includes doctor heading, fake Devin version, and node-pty availability.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Missing real Devin or node-pty path should produce warning in real use.

#### `TC-OPS-003` Quota checks ready accounts and skips needs-login accounts

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-005`, `FR-OPS-004`, `UC-OPS-04`, `NFR-COMPAT-002`
**Component under test:** `C-01`, `C-02`, `C-07`
**Preconditions:** Fake Devin shim active and node-pty available.
**Test Data:** two accounts, one marked needs-login, fake usage values.
**Steps:**
1. Add accounts `one` and `two`.
2. Mark `two` as needing login.
3. Run `dsw quota` with fake quota env values.
4. Capture stdout and exit code.
**Expected Result:** Ready account row contains parsed tier, used, remaining, and reset values; needs-login account is skipped with status.
**Implementation:** `tests/integration/cli.spec.ts`.
**Notes:** Unit parser coverage lives in `tests/unit/quota.spec.ts`.

#### `TC-OPS-004` Process capture helper handles output, timeout, and spawn failure

**Type:** unit
**Priority:** P1
**Related:** `NFR-USE-001`, `NFR-OBS-001`
**Component under test:** `C-04`, `C-07`
**Preconditions:** Node child process APIs available.
**Test Data:** commands that write stdout/stderr, ignore SIGTERM, and missing binary name.
**Steps:**
1. Run `runCapture` against a command that writes stdout and stderr.
2. Run a timed command that ignores SIGTERM.
3. Run a missing binary.
**Expected Result:** Output is captured separately, timeout is marked, and missing spawn rejects.
**Implementation:** `tests/unit/exec.spec.ts:4`.
**Notes:** Used by auth, doctor, and quota subprocess integrations.

#### `TC-SEC-001` Redaction covers auth-like secrets

**Type:** unit
**Priority:** P0
**Related:** `NFR-SEC-002`
**Component under test:** `C-04` helper
**Preconditions:** None.
**Test Data:** JWT-like token, Devin session token, Authorization header, JSON authorization field, standalone Bearer token, API/access key fields, `windsurf_api_key`.
**Steps:**
1. Call `redactText` with each sensitive input.
2. Assert original token text is absent and redaction marker is present.
**Expected Result:** Known sensitive forms are redacted without breaking quoted JSON shape.
**Implementation:** `tests/unit/redact.spec.ts:4`.
**Notes:** Used by auth status parser.

#### `TC-MAINT-001` Typecheck, lint, test, build pass

**Type:** manual
**Priority:** P0
**Related:** `FR-OPS-003`, `UC-OPS-03`, `NFR-MAINT-001`, `NFR-MAINT-002`
**Component under test:** `C-06`
**Preconditions:** Dependencies installed.
**Test Data:** n/a.
**Steps:**
1. Run `npm run typecheck`.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
**Expected Result:** All commands exit 0.
**Implementation:** npm scripts in `package.json:27`, `package.json:33`, `package.json:34`, and `package.json:35`.
**Notes:** Required before release.

#### `TC-MAINT-002` npm package metadata and tarball contents are release-ready

**Type:** manual
**Priority:** P0
**Related:** `FR-OPS-005`, `UC-OPS-03`, `BR-OPS-04`
**Component under test:** `C-01`, `C-06`
**Preconditions:** Dependencies installed.
**Test Data:** package metadata and pack output.
**Steps:**
1. Verify `package.json` and `package-lock.json` root name/version match.
2. Verify `bin.dsw` points to `bin/dsw`.
3. Run `npm pack --dry-run`.
4. Verify tarball file list includes runtime files only.
5. Verify `dsw --version` matches `package.json`.
6. Verify the release commit is pushed before `npm publish`.
**Expected Result:** Package is installable with `npm install -g @itsddvn/dsw`, exposes `dsw`, and is published only after codebase version references are aligned, committed, and pushed.
**Implementation:** npm commands plus package manifest.
**Notes:** Blocks public npm release when metadata drifts.

#### `TC-REL-001` Atomic JSON helper writes safely and tolerates malformed reads

**Type:** unit
**Priority:** P0
**Related:** `NFR-REL-001`
**Component under test:** `C-02`
**Preconditions:** Sandbox filesystem.
**Test Data:** JSON values, missing files, malformed JSON.
**Steps:**
1. Write JSON with `atomicWriteJsonSync`.
2. Verify parent directory and file modes.
3. Verify no temp file remains after success.
4. Read missing and malformed JSON through `readJsonOrNull`.
**Expected Result:** JSON writes are atomic-style and malformed reads return null.
**Implementation:** `tests/unit/atomic-write.spec.ts:7`.
**Notes:** Shared by account store and quota cache.

## 7. Non-Functional Test Cases

### 7.1 Performance (`TC-PERF-*`)

No dedicated performance test exists. `NFR-PERF-001` is indirectly covered by the 30-second integration timeout and absence of production sleeps.

### 7.2 Security (`TC-SEC-*`)

Security coverage is currently unit/integration only: redaction, profile env isolation, org id preservation, and fake Devin sandboxing.

### 7.3 Reliability (`TC-REL-*`)

Reliability coverage is embedded in store persistence, login-failure recovery, and profile runtime tests.

## 8. Coverage Matrix

### 8.1 FR coverage

| FR ID | Covering TCs | Gap? |
|-------|--------------|------|
| `FR-CLI-001` | `TC-RUN-003` | no |
| `FR-CLI-002` | `TC-CLI-001` | no |
| `FR-ACC-001` | `TC-ACC-001`, `TC-ACC-002` | no |
| `FR-ACC-002` | `TC-ACC-002` | no |
| `FR-ACC-003` | `TC-ACC-001`, `TC-AUTH-002` | no |
| `FR-ACC-004` | `TC-ACC-001`, `TC-ACC-002` | no |
| `FR-AUTH-001` | `TC-ACC-002`, `TC-AUTH-001` | no |
| `FR-AUTH-002` | `TC-AUTH-002` | no |
| `FR-AUTH-003` | `TC-AUTH-001` | no |
| `FR-RUN-001` | `TC-RUN-001`, `TC-RUN-003` | no |
| `FR-RUN-002` | `TC-RUN-002`, `TC-RUN-003` | no |
| `FR-RUN-003` | `TC-RUN-003` | no |
| `FR-RUN-004` | `TC-RUN-004` | no |
| `FR-RUN-005` | `TC-OPS-003` | no |
| `FR-RUN-006` | `TC-RUN-005`, `TC-OPS-003` | no |
| `FR-RUN-007` | `TC-RUN-006` | no |
| `FR-PROF-001` | `TC-PROF-002`, `TC-RUN-003` | no |
| `FR-PROF-002` | `TC-PROF-002` | no |
| `FR-PROF-003` | `TC-PROF-002` | no |
| `FR-PROF-004` | `TC-PROF-001` | no |
| `FR-PROF-005` | `TC-PROF-003` | no |
| `FR-OPS-001` | `TC-OPS-002` | no |
| `FR-OPS-002` | `TC-OPS-001` | no |
| `FR-OPS-003` | `TC-MAINT-001` | no |
| `FR-OPS-004` | `TC-OPS-003`, `TC-MAINT-001` | no |
| `FR-OPS-005` | `TC-MAINT-002` | no |

### 8.2 NFR coverage

| NFR ID | Covering TCs | Gap? |
|--------|--------------|------|
| `NFR-PERF-001` | `TC-RUN-003` | no |
| `NFR-REL-001` | `TC-ACC-001`, `TC-REL-001` | no |
| `NFR-REL-002` | `TC-AUTH-002` | no |
| `NFR-REL-003` | `TC-RUN-005` | no |
| `NFR-SEC-001` | `TC-PROF-002` | no |
| `NFR-SEC-002` | `TC-SEC-001` | no |
| `NFR-USE-001` | `TC-ACC-002`, `TC-AUTH-002`, `TC-RUN-003`, `TC-OPS-004` | no |
| `NFR-MAINT-001` | `TC-MAINT-001` | no |
| `NFR-MAINT-002` | `TC-MAINT-001` | no |
| `NFR-COMPAT-001` | `TC-MAINT-001` | no |
| `NFR-COMPAT-002` | `TC-OPS-002`, `TC-OPS-003`, `TC-MAINT-001` | no |
| `NFR-OBS-001` | `TC-OPS-002`, `TC-OPS-004` | no |

### 8.3 UC coverage

| UC ID | Covering TCs | Gap? |
|-------|--------------|------|
| `UC-ACC-01` | `TC-ACC-002` | no |
| `UC-AUTH-01` | `TC-ACC-002` | no |
| `UC-AUTH-02` | `TC-AUTH-001` | no |
| `UC-AUTH-03` | `TC-AUTH-002` | no |
| `UC-ACC-02` | `TC-ACC-002` | no |
| `UC-RUN-01` | `TC-RUN-001`, `TC-RUN-003`, `TC-RUN-005`, `TC-RUN-006` | no |
| `UC-RUN-02` | `TC-RUN-002`, `TC-RUN-003`, `TC-RUN-005` | no |
| `UC-RUN-03` | `TC-RUN-004` | no |
| `UC-OPS-04` | `TC-OPS-003`, `TC-RUN-005` | no |
| `UC-OPS-01` | `TC-OPS-002` | no |
| `UC-OPS-02` | `TC-OPS-001` | no |
| `UC-OPS-03` | `TC-MAINT-001`, `TC-MAINT-002` | no |

## 9. Execution & Reporting

- Local gate: `npm run typecheck && npm run lint && npm test && npm run build`.
- Pass criteria: 100% P0 tests pass before release.
- Reports: default Vitest terminal output; no JUnit/HTML report configured.
- Flaky-test policy: any intermittent failure blocks release until isolated or fixed.

---

## Traceability

### TC -> FR / NFR / UC / BR

| TC ID | FR | NFR | UC | BR |
|-------|----|-----|----|----|
| `TC-CLI-001` | `FR-CLI-002` | none | none | `BR-OPS-01` |
| `TC-ACC-001` | `FR-ACC-001`, `FR-ACC-003`, `FR-ACC-004` | `NFR-REL-001` | none | `BR-DATA-01`, `BR-DATA-02` |
| `TC-ACC-002` | `FR-ACC-002`, `FR-ACC-004` | `NFR-USE-001` | `UC-ACC-01`, `UC-ACC-02` | `BR-OPS-01`, `BR-DATA-02` |
| `TC-ACC-003` | `FR-ACC-001`, `FR-AUTH-003` | none | `UC-AUTH-01`, `UC-AUTH-02` | `BR-DATA-01` |
| `TC-AUTH-001` | `FR-AUTH-003` | none | `UC-AUTH-02` | `BR-DATA-01` |
| `TC-AUTH-002` | `FR-AUTH-002` | `NFR-REL-002` | `UC-AUTH-03` | `BR-AUTH-01` |
| `TC-RUN-001` | `FR-RUN-001` | none | `UC-RUN-01` | `BR-AUTH-01` |
| `TC-RUN-002` | `FR-RUN-002` | none | `UC-RUN-02` | `BR-AUTH-01` |
| `TC-RUN-003` | `FR-RUN-003`, `FR-CLI-001` | `NFR-PERF-001`, `NFR-USE-001` | `UC-RUN-01`, `UC-RUN-02` | `BR-OPS-01` |
| `TC-RUN-004` | `FR-RUN-004`, `FR-RUN-003` | `NFR-USE-001` | `UC-RUN-03` | `BR-AUTH-01`, `BR-OPS-01` |
| `TC-RUN-005` | `FR-RUN-006` | `NFR-REL-003` | `UC-RUN-01`, `UC-RUN-02`, `UC-OPS-04` | `BR-DATA-04` |
| `TC-RUN-006` | `FR-RUN-007` | none | `UC-RUN-01` | `BR-AUTH-01`, `BR-OPS-01` |
| `TC-PROF-001` | `FR-PROF-004` | none | none | `BR-DATA-01` |
| `TC-PROF-002` | `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` | `NFR-SEC-001` | `UC-RUN-01` | `BR-SEC-01`, `BR-SEC-02`, `BR-DATA-03` |
| `TC-PROF-003` | `FR-PROF-005` | none | none | `BR-SEC-02` |
| `TC-OPS-001` | `FR-OPS-002` | none | `UC-OPS-02` | `BR-OPS-01` |
| `TC-OPS-002` | `FR-OPS-001` | `NFR-OBS-001` | `UC-OPS-01` | `BR-OPS-01` |
| `TC-OPS-003` | `FR-RUN-005`, `FR-OPS-004` | `NFR-COMPAT-002` | `UC-OPS-04` | `BR-AUTH-01`, `BR-OPS-03` |
| `TC-OPS-004` | none | `NFR-USE-001`, `NFR-OBS-001` | none | `BR-OPS-01` |
| `TC-SEC-001` | none | `NFR-SEC-002` | none | `BR-SEC-02` |
| `TC-MAINT-001` | `FR-OPS-003` | `NFR-MAINT-001`, `NFR-MAINT-002`, `NFR-COMPAT-001` | `UC-OPS-03` | `BR-OPS-02` |
| `TC-MAINT-002` | `FR-OPS-005` | `NFR-MAINT-001` | `UC-OPS-03` | `BR-OPS-04` |
| `TC-REL-001` | none | `NFR-REL-001` | none | `BR-DATA-01`, `BR-DATA-04` |

### TC -> Component

| TC ID | `C-*` |
|-------|-------|
| `TC-CLI-001` | `C-01` |
| `TC-ACC-001` | `C-02` |
| `TC-ACC-002` | `C-01`, `C-02`, `C-03`, `C-04` |
| `TC-ACC-003` | `C-01`, `C-02` |
| `TC-AUTH-001` | `C-01`, `C-02`, `C-04` |
| `TC-AUTH-002` | `C-01`, `C-02`, `C-04` |
| `TC-RUN-001` | `C-04` |
| `TC-RUN-002` | `C-04` |
| `TC-RUN-003` | `C-01`, `C-04`, `C-05` |
| `TC-RUN-004` | `C-01`, `C-04`, `C-05` |
| `TC-RUN-005` | `C-02`, `C-07` |
| `TC-RUN-006` | `C-04`, `C-07` |
| `TC-PROF-001` | `C-03` |
| `TC-PROF-002` | `C-05` |
| `TC-PROF-003` | `C-05` |
| `TC-OPS-001` | `C-01` |
| `TC-OPS-002` | `C-01`, `C-04`, `C-07` |
| `TC-OPS-003` | `C-01`, `C-02`, `C-07` |
| `TC-OPS-004` | `C-04`, `C-07` |
| `TC-SEC-001` | `C-04` |
| `TC-MAINT-001` | `C-06` |
| `TC-MAINT-002` | `C-01`, `C-06` |
| `TC-REL-001` | `C-02` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added direct account, quota reporting, node-pty diagnostics, and quota parser coverage. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial test-case catalog extracted from Vitest suite. |
| 1.2.0 | 2026-05-07 | itsddvn | Added quota-aware automatic selection unit and integration coverage. |
| 1.3.0 | 2026-05-07 | itsddvn | Added quota cache, package release, helper utility, atomic write, exec, and expanded redaction coverage. |
| 1.4.0 | 2026-05-08 | itsddvn | Added rate-limit retry and quota-switch regression coverage for `0.4.8`. |
