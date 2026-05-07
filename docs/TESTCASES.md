# Test Cases - devin-switcher

**Version:** 1.1.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** SRS v1.1.0, USECASES v1.1.0, `tests/`
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
| `TC-CLI-001` | Help lists supported commands | integration | P0 | `FR-CLI-002` | Implemented |
| `TC-ACC-001` | Store creates, lists, updates, removes accounts | unit | P0 | `FR-ACC-001`, `FR-ACC-003`, `FR-ACC-004` | Implemented |
| `TC-ACC-002` | CLI add-list-remove flow | integration | P0 | `FR-ACC-002`, `FR-ACC-004`, `UC-ACC-01`, `UC-ACC-02` | Implemented |
| `TC-AUTH-001` | Add unnamed account infers name | integration | P1 | `FR-AUTH-003`, `UC-AUTH-02` | Implemented |
| `TC-AUTH-002` | Login failure marks needs-login | integration | P0 | `FR-AUTH-002`, `UC-AUTH-03`, `NFR-REL-002` | Implemented |
| `TC-RUN-001` | LRU selector behavior | unit | P0 | `FR-RUN-001`, `UC-RUN-01` | Implemented |
| `TC-RUN-002` | List-order selector behavior | unit | P0 | `FR-RUN-002`, `UC-RUN-02` | Implemented |
| `TC-RUN-003` | CLI forwards Devin args | integration | P0 | `FR-RUN-003`, `UC-RUN-01`, `UC-RUN-02` | Implemented |
| `TC-RUN-004` | Specific account command forwards Devin args | integration | P0 | `FR-RUN-004`, `UC-RUN-03` | Implemented |
| `TC-PROF-001` | App path resolution | unit | P0 | `FR-PROF-004` | Implemented |
| `TC-PROF-002` | Profile runtime symlink and config sync | unit | P0 | `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` | Implemented |
| `TC-PROF-003` | Profile org id reader | unit | P1 | `FR-PROF-005` | Implemented |
| `TC-OPS-001` | Update dry-run prints local checkout steps | integration | P1 | `FR-OPS-002`, `UC-OPS-02` | Implemented |
| `TC-OPS-002` | Doctor reports paths, Devin version, and tmux version | integration | P1 | `FR-OPS-001`, `UC-OPS-01`, `NFR-OBS-001` | Implemented |
| `TC-OPS-003` | Quota checks ready accounts and skips needs-login accounts | integration | P0 | `FR-RUN-005`, `FR-OPS-004`, `UC-OPS-04`, `NFR-COMPAT-002` | Implemented |
| `TC-SEC-001` | Redaction covers auth-like secrets | unit | P0 | `NFR-SEC-002` | Implemented |
| `TC-MAINT-001` | Typecheck, lint, test, build pass | manual | P0 | `FR-OPS-003`, `UC-OPS-03`, `NFR-MAINT-001`, `NFR-MAINT-002` | Implemented by commands |

## 6. Test Cases - Detail

### 6.1 CLI

#### `TC-CLI-001` Help lists supported commands

**Type:** integration
**Priority:** P0
**Related:** `FR-CLI-002`
**Component under test:** `C-01`
**Preconditions:** Test shim is on `PATH`.
**Test Data:** args `["--help"]`.
**Steps:**
1. Run CLI through `tsx`.
2. Capture stdout and exit code.
3. Assert exit code 0 and commands are present.
**Expected Result:** Help includes `list`, `add`, `remove`, `login`, `next`, `use`, `quota`, `update`, and `doctor`.
**Implementation:** `tests/integration/cli.spec.ts:58`.
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
**Implementation:** `tests/integration/cli.spec.ts:67`.
**Notes:** Removal refusal is covered at `tests/integration/cli.spec.ts:100`.

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
**Implementation:** `tests/integration/cli.spec.ts:83`, `tests/integration/cli.spec.ts:94`.
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
**Implementation:** `tests/integration/cli.spec.ts:153`.
**Notes:** Protects recovery behavior.

### 6.4 RUN

#### `TC-RUN-001` LRU selector behavior

**Type:** unit
**Priority:** P0
**Related:** `FR-RUN-001`, `UC-RUN-01`
**Component under test:** `C-04` selection function
**Preconditions:** In-memory accounts.
**Test Data:** Ready and needs-login accounts with different timestamps.
**Steps:**
1. Call `pickNextAccount` with timestamp variants.
2. Call it with never-used accounts.
3. Call it with all accounts needing login.
**Expected Result:** Least recently used ready account wins; null when none eligible.
**Implementation:** `tests/unit/runner-pick.spec.ts:20`.
**Notes:** LRU is current replacement for stale quota scope.

#### `TC-RUN-002` List-order selector behavior

**Type:** unit
**Priority:** P0
**Related:** `FR-RUN-002`, `UC-RUN-02`
**Component under test:** `C-04` selection function
**Preconditions:** In-memory accounts.
**Test Data:** Ordered accounts with current inferred from latest timestamp.
**Steps:**
1. Call `pickNextAccountInList` with no used accounts.
2. Call it with a most-recently-used middle account.
3. Call it with wraparound and skipped login account.
**Expected Result:** First eligible, next eligible, wraparound, and null cases behave as specified.
**Implementation:** `tests/unit/runner-pick.spec.ts:60`.
**Notes:** Covers explicit `dsw next` semantics.

#### `TC-RUN-003` CLI forwards Devin args

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-003`, `UC-RUN-01`, `UC-RUN-02`
**Component under test:** `C-01`, `C-04`, `C-05`
**Preconditions:** Ready accounts exist.
**Test Data:** `some forwarded args`, `next -p hello`.
**Steps:**
1. Add accounts.
2. Set timestamps in store.
3. Run default command with unknown args.
4. Run `dsw next -p hello`.
**Expected Result:** Selected account is printed and fake Devin receives forwarded args.
**Implementation:** `tests/integration/cli.spec.ts:107`, `tests/integration/cli.spec.ts:129`.
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
**Implementation:** `tests/integration/cli.spec.ts:137`.
**Notes:** Verifies direct account selection bypasses rotation.

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
**Implementation:** `tests/integration/cli.spec.ts:138`.
**Notes:** Does not mutate repo.

#### `TC-OPS-002` Doctor reports paths, Devin version, and tmux version

**Type:** integration
**Priority:** P1
**Related:** `FR-OPS-001`, `UC-OPS-01`, `NFR-OBS-001`
**Component under test:** `C-01`, `C-04`, `C-07`
**Preconditions:** Fake Devin shim active.
**Test Data:** `doctor`.
**Steps:**
1. Run `dsw doctor`.
2. Capture stdout and exit code.
**Expected Result:** Output includes doctor heading, fake Devin version, and tmux version.
**Implementation:** `tests/integration/cli.spec.ts:192`.
**Notes:** Missing real Devin or tmux path should produce warning in real use.

#### `TC-OPS-003` Quota checks ready accounts and skips needs-login accounts

**Type:** integration
**Priority:** P0
**Related:** `FR-RUN-005`, `FR-OPS-004`, `UC-OPS-04`, `NFR-COMPAT-002`
**Component under test:** `C-01`, `C-02`, `C-07`
**Preconditions:** Fake Devin shim active and tmux available.
**Test Data:** two accounts, one marked needs-login, fake usage values.
**Steps:**
1. Add accounts `one` and `two`.
2. Mark `two` as needing login.
3. Run `dsw quota` with fake quota env values.
4. Capture stdout and exit code.
**Expected Result:** Ready account row contains parsed tier, used, remaining, and reset values; needs-login account is skipped with status.
**Implementation:** `tests/integration/cli.spec.ts:153`.
**Notes:** Unit parser coverage lives in `tests/unit/quota.spec.ts`.

#### `TC-SEC-001` Redaction covers auth-like secrets

**Type:** unit
**Priority:** P0
**Related:** `NFR-SEC-002`
**Component under test:** `C-04` helper
**Preconditions:** None.
**Test Data:** JWT-like token, Devin session token, Authorization header.
**Steps:**
1. Call `redactText` with each sensitive input.
2. Assert original token text is absent and redaction marker is present.
**Expected Result:** Known sensitive forms are redacted.
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
**Implementation:** npm scripts in `package.json:8`.
**Notes:** Required before release.

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
| `FR-PROF-001` | `TC-PROF-002`, `TC-RUN-003` | no |
| `FR-PROF-002` | `TC-PROF-002` | no |
| `FR-PROF-003` | `TC-PROF-002` | no |
| `FR-PROF-004` | `TC-PROF-001` | no |
| `FR-PROF-005` | `TC-PROF-003` | no |
| `FR-OPS-001` | `TC-OPS-002` | no |
| `FR-OPS-002` | `TC-OPS-001` | no |
| `FR-OPS-003` | `TC-MAINT-001` | no |
| `FR-OPS-004` | `TC-OPS-003`, `TC-MAINT-001` | no |

### 8.2 NFR coverage

| NFR ID | Covering TCs | Gap? |
|--------|--------------|------|
| `NFR-PERF-001` | `TC-RUN-003` | no |
| `NFR-REL-001` | `TC-ACC-001` | no |
| `NFR-REL-002` | `TC-AUTH-002` | no |
| `NFR-SEC-001` | `TC-PROF-002` | no |
| `NFR-SEC-002` | `TC-SEC-001` | no |
| `NFR-USE-001` | `TC-ACC-002`, `TC-AUTH-002`, `TC-RUN-003` | no |
| `NFR-MAINT-001` | `TC-MAINT-001` | no |
| `NFR-MAINT-002` | `TC-MAINT-001` | no |
| `NFR-COMPAT-001` | `TC-MAINT-001` | no |
| `NFR-COMPAT-002` | `TC-OPS-002`, `TC-OPS-003`, `TC-MAINT-001` | no |
| `NFR-OBS-001` | `TC-OPS-002` | no |

### 8.3 UC coverage

| UC ID | Covering TCs | Gap? |
|-------|--------------|------|
| `UC-ACC-01` | `TC-ACC-002` | no |
| `UC-AUTH-01` | `TC-ACC-002` | no |
| `UC-AUTH-02` | `TC-AUTH-001` | no |
| `UC-AUTH-03` | `TC-AUTH-002` | no |
| `UC-ACC-02` | `TC-ACC-002` | no |
| `UC-RUN-01` | `TC-RUN-001`, `TC-RUN-003` | no |
| `UC-RUN-02` | `TC-RUN-002`, `TC-RUN-003` | no |
| `UC-RUN-03` | `TC-RUN-004` | no |
| `UC-OPS-04` | `TC-OPS-003` | no |
| `UC-OPS-01` | `TC-OPS-002` | no |
| `UC-OPS-02` | `TC-OPS-001` | no |
| `UC-OPS-03` | `TC-MAINT-001` | no |

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
| `TC-AUTH-001` | `FR-AUTH-003` | none | `UC-AUTH-02` | `BR-DATA-01` |
| `TC-AUTH-002` | `FR-AUTH-002` | `NFR-REL-002` | `UC-AUTH-03` | `BR-AUTH-01` |
| `TC-RUN-001` | `FR-RUN-001` | none | `UC-RUN-01` | `BR-AUTH-01` |
| `TC-RUN-002` | `FR-RUN-002` | none | `UC-RUN-02` | `BR-AUTH-01` |
| `TC-RUN-003` | `FR-RUN-003`, `FR-CLI-001` | `NFR-PERF-001`, `NFR-USE-001` | `UC-RUN-01`, `UC-RUN-02` | `BR-OPS-01` |
| `TC-RUN-004` | `FR-RUN-004`, `FR-RUN-003` | `NFR-USE-001` | `UC-RUN-03` | `BR-AUTH-01`, `BR-OPS-01` |
| `TC-PROF-001` | `FR-PROF-004` | none | none | `BR-DATA-01` |
| `TC-PROF-002` | `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` | `NFR-SEC-001` | `UC-RUN-01` | `BR-SEC-01`, `BR-SEC-02`, `BR-DATA-03` |
| `TC-PROF-003` | `FR-PROF-005` | none | none | `BR-SEC-02` |
| `TC-OPS-001` | `FR-OPS-002` | none | `UC-OPS-02` | `BR-OPS-01` |
| `TC-OPS-002` | `FR-OPS-001` | `NFR-OBS-001` | `UC-OPS-01` | `BR-OPS-01` |
| `TC-OPS-003` | `FR-RUN-005`, `FR-OPS-004` | `NFR-COMPAT-002` | `UC-OPS-04` | `BR-AUTH-01`, `BR-OPS-03` |
| `TC-SEC-001` | none | `NFR-SEC-002` | none | `BR-SEC-02` |
| `TC-MAINT-001` | `FR-OPS-003` | `NFR-MAINT-001`, `NFR-MAINT-002`, `NFR-COMPAT-001` | `UC-OPS-03` | `BR-OPS-02` |

### TC -> Component

| TC ID | `C-*` |
|-------|-------|
| `TC-CLI-001` | `C-01` |
| `TC-ACC-001` | `C-02` |
| `TC-ACC-002` | `C-01`, `C-02`, `C-03`, `C-04` |
| `TC-AUTH-001` | `C-01`, `C-02`, `C-04` |
| `TC-AUTH-002` | `C-01`, `C-02`, `C-04` |
| `TC-RUN-001` | `C-04` |
| `TC-RUN-002` | `C-04` |
| `TC-RUN-003` | `C-01`, `C-04`, `C-05` |
| `TC-RUN-004` | `C-01`, `C-04`, `C-05` |
| `TC-PROF-001` | `C-03` |
| `TC-PROF-002` | `C-05` |
| `TC-PROF-003` | `C-05` |
| `TC-OPS-001` | `C-01` |
| `TC-OPS-002` | `C-01`, `C-04`, `C-07` |
| `TC-OPS-003` | `C-01`, `C-02`, `C-07` |
| `TC-SEC-001` | `C-04` |
| `TC-MAINT-001` | `C-06` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added direct account, quota reporting, tmux diagnostics, and quota parser coverage. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial test-case catalog extracted from Vitest suite. |
