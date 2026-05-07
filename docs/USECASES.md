# Use Cases - devin-switcher

**Version:** 1.2.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** PRD v1.2.0, SRS v1.2.0
**Owner:** itsddvn

---

## 1. Actors

| Actor | Type | Description |
|-------|------|-------------|
| Local operator | Primary | Person running `dsw` commands on a workstation. |
| Maintainer | Primary | Person maintaining, testing, and releasing the CLI. |
| Devin CLI | External | External binary invoked for auth and execution. |
| Local filesystem | System | Stores account metadata, profile dirs, credentials written by Devin, and config files. |

## 2. Use-Case Index

| UC ID | Name | Actor | Trigger | Primary SRS |
|-------|------|-------|---------|-------------|
| `UC-ACC-01` | List accounts | Local operator | `dsw list` | `FR-ACC-002` |
| `UC-AUTH-01` | Add named account | Local operator | `dsw add work` | `FR-AUTH-001` |
| `UC-AUTH-02` | Add unnamed account | Local operator | `dsw add` | `FR-AUTH-003` |
| `UC-AUTH-03` | Re-login account | Local operator | `dsw login work` | `FR-AUTH-002` |
| `UC-ACC-02` | Remove account | Local operator | `dsw remove work --yes` | `FR-ACC-004` |
| `UC-RUN-01` | Run Devin by quota-aware selection | Local operator | `dsw -p "fix bug"` | `FR-RUN-001` |
| `UC-RUN-02` | Run next account by maximum quota | Local operator | `dsw next -p hello` | `FR-RUN-002` |
| `UC-RUN-03` | Run specific account | Local operator | `dsw use work -p hello` | `FR-RUN-004` |
| `UC-OPS-04` | Check managed account quota | Local operator | `dsw quota` | `FR-RUN-005` |
| `UC-OPS-01` | Diagnose install | Local operator | `dsw doctor` | `FR-OPS-001` |
| `UC-OPS-02` | Update install | Local operator | `dsw update` | `FR-OPS-002` |
| `UC-OPS-03` | Verify release | Maintainer | Release prep | `FR-OPS-003` |

## 3. Detailed Use Cases (Cockburn-style)

### UC-ACC-01 List accounts

- **Actor:** Local operator.
- **Scope:** `dsw` CLI.
- **Level:** user-goal.
- **Preconditions:** `dsw` is installed.
- **Trigger:** Operator runs `dsw list` or `dsw ls`.
- **Main Success Scenario:**
  1. CLI loads account store.
  2. CLI formats account rows with status and metadata.
  3. CLI prints the table.
- **Extensions:**
  - 2a. No accounts exist -> CLI prints the empty-state message.
- **Postconditions:** Store is unchanged.
- **Related SRS:** `FR-ACC-002`.
- **Related BR:** `BR-OPS-01`.
- **Route:** n/a.

### UC-AUTH-01 Add named account

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** `devin` is on `PATH`; account name is unique and valid.
- **Trigger:** Operator runs `dsw add work`.
- **Main Success Scenario:**
  1. CLI creates account record with `needsLogin = true`.
  2. CLI creates profile directories.
  3. CLI runs `devin auth login` with profile env.
  4. CLI reads `devin auth status`.
  5. CLI stores auth metadata and clears `needsLogin`.
  6. CLI prints added account confirmation.
- **Extensions:**
  - 3a. Login fails -> CLI marks process failed, rolls back only where applicable, and exits non-zero.
  - 4a. Status says not logged in -> CLI marks account as needing login and prints retry guidance.
- **Postconditions:** Account exists and is ready after success.
- **Related SRS:** `FR-ACC-001`, `FR-AUTH-001`, `FR-ACC-003`.
- **Related BR:** `BR-SEC-01`, `BR-DATA-01`.
- **Route:** n/a.

### UC-AUTH-02 Add unnamed account

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** `devin` is on `PATH`.
- **Trigger:** Operator runs `dsw add` without a name.
- **Main Success Scenario:**
  1. CLI creates a pending unique account.
  2. CLI runs `devin auth login`.
  3. CLI reads auth status.
  4. CLI derives a slug from Name or email local-part.
  5. CLI renames the pending account and stores auth metadata.
- **Extensions:**
  - 4a. No usable name/email exists -> CLI rolls back pending account and instructs operator to pass a name.
  - 4b. Derived name exists -> CLI appends a numeric suffix.
- **Postconditions:** Account has a human-meaningful unique name after success.
- **Related SRS:** `FR-AUTH-001`, `FR-AUTH-003`.
- **Related BR:** `BR-DATA-01`.
- **Route:** n/a.

### UC-AUTH-03 Re-login account

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** Target account exists.
- **Trigger:** Operator runs `dsw login work`.
- **Main Success Scenario:**
  1. CLI loads the target account.
  2. CLI ensures profile directories exist.
  3. CLI runs `devin auth login` under the profile.
  4. CLI reads auth status and updates metadata.
  5. CLI prints success.
- **Extensions:**
  - 3a. Login fails -> CLI marks account `needsLogin = true` and exits non-zero.
  - 4a. Status remains not logged in -> CLI marks account `needsLogin = true`.
- **Postconditions:** Account is ready after success or flagged for login after failure.
- **Related SRS:** `FR-AUTH-002`, `FR-ACC-003`.
- **Related BR:** `BR-AUTH-01`, `BR-SEC-01`.
- **Route:** n/a.

### UC-ACC-02 Remove account

- **Actor:** Local operator.
- **Scope:** `dsw` CLI.
- **Level:** user-goal.
- **Preconditions:** Target account exists.
- **Trigger:** Operator runs `dsw remove work --yes`.
- **Main Success Scenario:**
  1. CLI validates `--yes`.
  2. CLI removes account from store.
  3. CLI removes profile directory.
  4. CLI prints removal confirmation.
- **Extensions:**
  - 1a. `--yes` omitted -> CLI refuses and prints required syntax.
  - 2a. Account missing -> CLI exits with account-not-found error.
- **Postconditions:** Account record and profile dir are removed after success.
- **Related SRS:** `FR-ACC-004`.
- **Related BR:** `BR-DATA-02`.
- **Route:** n/a.

### UC-RUN-01 Run Devin by quota-aware selection

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** At least one account exists and is ready.
- **Trigger:** Operator runs `dsw [args...]`.
- **Main Success Scenario:**
  1. CLI loads accounts.
  2. CLI filters out accounts needing login.
  3. CLI checks quota for ready accounts.
  4. CLI chooses the account with the highest known remaining quota, using least-recently-used as the tie-breaker.
  5. CLI updates selected account `lastUsedAt`.
  6. CLI prepares profile runtime.
  7. CLI spawns `devin` with forwarded args and profile env.
  8. CLI persists runtime config after Devin exits.
- **Extensions:**
  - 1a. No accounts exist -> CLI instructs operator to run `dsw add <name>`.
  - 2a. No eligible accounts exist -> CLI instructs operator to run `dsw login <name>`.
- **Postconditions:** Selected account has updated `lastUsedAt`.
- **Related SRS:** `FR-RUN-001`, `FR-RUN-003`, `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003`.
- **Related BR:** `BR-AUTH-01`, `BR-SEC-01`, `BR-DATA-03`.
- **Route:** n/a.

### UC-RUN-02 Run next account by maximum quota

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** At least one account exists and is ready.
- **Trigger:** Operator runs `dsw next [args...]`.
- **Main Success Scenario:**
  1. CLI loads accounts.
  2. CLI checks quota for ready accounts.
  3. CLI selects the account with the highest known remaining quota.
  4. CLI runs Devin under the selected account profile.
- **Extensions:**
  - 2a. Account needs login -> CLI skips it before quota checks.
  - 3a. All ready accounts are exhausted -> CLI exits with no-eligible error.
- **Postconditions:** Selected account has updated `lastUsedAt`.
- **Related SRS:** `FR-RUN-002`, `FR-RUN-003`.
- **Related BR:** `BR-AUTH-01`.
- **Route:** n/a.

### UC-RUN-03 Run specific account

- **Actor:** Local operator.
- **Scope:** `dsw` CLI plus Devin CLI.
- **Level:** user-goal.
- **Preconditions:** Target account exists and is ready.
- **Trigger:** Operator runs `dsw use work [args...]`.
- **Main Success Scenario:**
  1. CLI loads the named account.
  2. CLI rejects the account if it needs login.
  3. CLI prepares profile runtime for the account.
  4. CLI spawns `devin` with forwarded args and profile env.
  5. CLI persists runtime config after Devin exits.
- **Extensions:**
  - 1a. Account missing -> CLI exits with account-not-found error.
  - 2a. Account needs login -> CLI prints `dsw login <name>` recovery guidance.
- **Postconditions:** Selected account has updated `lastUsedAt`.
- **Related SRS:** `FR-RUN-004`, `FR-RUN-003`, `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003`.
- **Related BR:** `BR-AUTH-01`, `BR-OPS-01`.
- **Route:** n/a.

### UC-OPS-04 Check managed account quota

- **Actor:** Local operator.
- **Scope:** `dsw` CLI, tmux, and Devin CLI.
- **Level:** user-goal.
- **Preconditions:** `tmux` and `devin` are on `PATH`; at least one account exists.
- **Trigger:** Operator runs `dsw quota`.
- **Main Success Scenario:**
  1. CLI loads all accounts.
  2. CLI skips accounts marked as needing login.
  3. CLI starts a short-lived tmux session for each ready account with that account's profile env.
  4. CLI sends `/usage`, captures terminal output, and destroys the session.
  5. CLI parses tier, used percentage, remaining percentage, and reset timing when present.
  6. CLI prints a quota table for all managed accounts.
- **Extensions:**
  - 2a. Account needs login -> row status is `needs login`.
  - 3a. tmux or Devin fails for one account -> row status is `error`; scan continues.
- **Postconditions:** Store is unchanged.
- **Related SRS:** `FR-RUN-005`, `FR-OPS-004`, `NFR-COMPAT-002`.
- **Related BR:** `BR-AUTH-01`, `BR-OPS-03`.
- **Route:** n/a.

### UC-OPS-01 Diagnose install

- **Actor:** Local operator.
- **Scope:** `dsw` CLI.
- **Level:** user-goal.
- **Preconditions:** `dsw` can run.
- **Trigger:** Operator runs `dsw doctor`.
- **Main Success Scenario:**
  1. CLI resolves app paths.
  2. CLI creates data/profile roots if needed.
  3. CLI runs `devin --version`.
  4. CLI runs `tmux -V`.
  5. CLI prints paths, Devin status, tmux status, and account count.
- **Extensions:**
  - 3a. Devin missing or errors -> CLI prints warning and exits non-zero.
  - 4a. tmux missing or errors -> CLI prints warning and exits non-zero.
- **Postconditions:** Diagnostic output is available to operator.
- **Related SRS:** `FR-OPS-001`, `NFR-OBS-001`.
- **Related BR:** `BR-OPS-01`.
- **Route:** n/a.

### UC-OPS-02 Update install

- **Actor:** Local operator.
- **Scope:** `dsw` CLI and local package root.
- **Level:** user-goal.
- **Preconditions:** `dsw` can locate its package root.
- **Trigger:** Operator runs `dsw update` or `dsw update --dry-run`.
- **Main Success Scenario:**
  1. CLI locates package root.
  2. CLI chooses git checkout update commands or global npm install command.
  3. CLI prints commands for dry-run or executes them sequentially.
  4. CLI stops on first non-zero command.
- **Extensions:**
  - 2a. npm install path is private package -> CLI throws cannot-update error.
- **Postconditions:** Install is updated or operator sees the failing step.
- **Related SRS:** `FR-OPS-002`.
- **Related BR:** `BR-OPS-01`.
- **Route:** n/a.

### UC-OPS-03 Verify release

- **Actor:** Maintainer.
- **Scope:** repository.
- **Level:** user-goal.
- **Preconditions:** Dependencies installed.
- **Trigger:** Maintainer prepares release.
- **Main Success Scenario:**
  1. Maintainer runs `npm run typecheck`.
  2. Maintainer runs `npm run lint`.
  3. Maintainer runs `npm test`.
  4. Maintainer runs `npm run build`.
  5. Maintainer verifies package version source.
- **Extensions:**
  - Any command fails -> release is blocked until fixed.
- **Postconditions:** Release candidate meets verification gate.
- **Related SRS:** `FR-OPS-003`, `NFR-MAINT-001`, `NFR-MAINT-002`.
- **Related BR:** `BR-OPS-02`.
- **Route:** n/a.

## 4. Briefly-Stated Use Cases

All selected use cases are detailed in section 3.

---

## Traceability

### UC -> SRS
| UC ID | SRS IDs |
|-------|---------|
| `UC-ACC-01` | `FR-ACC-002` |
| `UC-AUTH-01` | `FR-ACC-001`, `FR-AUTH-001`, `FR-ACC-003` |
| `UC-AUTH-02` | `FR-AUTH-001`, `FR-AUTH-003` |
| `UC-AUTH-03` | `FR-AUTH-002`, `FR-ACC-003` |
| `UC-ACC-02` | `FR-ACC-004` |
| `UC-RUN-01` | `FR-RUN-001`, `FR-RUN-003`, `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` |
| `UC-RUN-02` | `FR-RUN-002`, `FR-RUN-003` |
| `UC-RUN-03` | `FR-RUN-004`, `FR-RUN-003`, `FR-PROF-001`, `FR-PROF-002`, `FR-PROF-003` |
| `UC-OPS-04` | `FR-RUN-005`, `FR-OPS-004`, `NFR-COMPAT-002` |
| `UC-OPS-01` | `FR-OPS-001`, `NFR-OBS-001` |
| `UC-OPS-02` | `FR-OPS-002` |
| `UC-OPS-03` | `FR-OPS-003`, `NFR-MAINT-001`, `NFR-MAINT-002` |

### UC -> SITEMAP route
| UC ID | Route |
|-------|-------|
| `UC-ACC-01` | n/a |
| `UC-AUTH-01` | n/a |
| `UC-AUTH-02` | n/a |
| `UC-AUTH-03` | n/a |
| `UC-ACC-02` | n/a |
| `UC-RUN-01` | n/a |
| `UC-RUN-02` | n/a |
| `UC-RUN-03` | n/a |
| `UC-OPS-04` | n/a |
| `UC-OPS-01` | n/a |
| `UC-OPS-02` | n/a |
| `UC-OPS-03` | n/a |

### UC -> BR
| UC ID | BR IDs |
|-------|--------|
| `UC-ACC-01` | `BR-OPS-01` |
| `UC-AUTH-01` | `BR-SEC-01`, `BR-DATA-01` |
| `UC-AUTH-02` | `BR-DATA-01` |
| `UC-AUTH-03` | `BR-AUTH-01`, `BR-SEC-01` |
| `UC-ACC-02` | `BR-DATA-02` |
| `UC-RUN-01` | `BR-AUTH-01`, `BR-SEC-01`, `BR-DATA-03` |
| `UC-RUN-02` | `BR-AUTH-01` |
| `UC-RUN-03` | `BR-AUTH-01`, `BR-OPS-01` |
| `UC-OPS-04` | `BR-AUTH-01`, `BR-OPS-03` |
| `UC-OPS-01` | `BR-OPS-01` |
| `UC-OPS-02` | `BR-OPS-01` |
| `UC-OPS-03` | `BR-OPS-02` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added direct-account execution, quota reporting, and tmux-aware diagnostics use cases. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial use-case extraction from CLI commands and tests. |
| 1.2.0 | 2026-05-07 | itsddvn | Updated automatic run use cases for quota-aware selection. |
