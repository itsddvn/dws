# Tech Stack - devin-switcher

**Version:** 1.2.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** PRD v1.3.0, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.mjs`
**Owner:** itsddvn

---

## 1. Purpose

This document is the source of truth for technology choices in `devin-switcher`. `package.json` is the product manifest source for package name, version, binary mapping, publish files, scripts, and requested dependency ranges; `package-lock.json` is the installed dependency source.

## 2. Conventions

- IDs use `TS-{CAT}-{NN}`.
- Versions below use the effective installed version when lock-file lines identify it.
- External documentation URLs are referenced through `EXT-*` IDs in `EXTERNAL_DOCS.md`.

## 3. Stack at a Glance

| ID | Layer | Choice | Version | Lifecycle | Source |
|----|-------|--------|---------|-----------|--------|
| `TS-LANG-01` | Language | TypeScript | 5.9.3 | Adopted | `package-lock.json:2962` |
| `TS-RT-02` | Runtime | Node.js | >=20 | Adopted | `package.json:38` |
| `TS-FW-03` | CLI framework | commander | 14.0.3 installed, `^14.0.2` requested | Adopted | `package.json:41`, `package-lock.json:1618` |
| `TS-BUILD-04` | Build compiler | TypeScript compiler | 5.9.3 | Adopted | `package.json:27`, `package.json:48`, `tsconfig.json:1`, `tsconfig.build.json:1` |
| `TS-TEST-05` | Test framework | Vitest | 4.1.5 installed, `^4.0.14` requested | Adopted | `package.json:50`, `package-lock.json:3094` |
| `TS-TEST-06` | Integration test runner | tsx | 4.21.0 installed, `^4.20.6` requested | Adopted | `package.json:47`, `package-lock.json:2928` |
| `TS-BUILD-07` | Lint | ESLint | 9.39.4 installed, `^9.39.1` requested | Adopted | `package.json:46`, `package-lock.json:1753` |
| `TS-BUILD-08` | TypeScript ESLint | typescript-eslint | 8.59.2 installed, `^8.46.4` requested | Adopted | `package.json:49`, `package-lock.json:2975` |
| `TS-SEC-09` | Credential process | Devin CLI | External binary on `PATH` | Adopted | `README.md:14`, `src/core/auth.ts:35` |
| `TS-DATA-10` | Persistence | Local JSON file | Store file version 1 | Adopted | `src/core/store.ts:18` |
| `TS-INFRA-11` | Terminal automation | node-pty | External binary on `PATH` | Adopted | `README.md:14`, `node-pty optional dependency:1`, `src/core/quota.ts:1` |
| `TS-PKG-12` | Package distribution | npm scoped package | `@itsddvn/dsw@0.4.1` | Adopted | `package.json:2`, `package.json:3`, `package-lock.json:2` |

## 4. Detail by Choice

### TS-LANG-01 TypeScript

**Layer:** Language
**Version (pinned):** 5.9.3 installed
**Lifecycle:** Adopted
**License:** Apache-2.0
**Lock file ref:** `package-lock.json:2962`
**Rationale:** TypeScript gives strict typing for filesystem, process, and account-store boundaries in a small CLI without runtime framework overhead.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| JavaScript | n/a | Less protection around account metadata shape and env construction. |
| Go | n/a | Would add a new toolchain without current repo support. |

**Upgrade policy:** Patch/minor through npm lock refresh; major requires CLI compatibility review.

### TS-RT-02 Node.js

**Layer:** Runtime
**Version (pinned):** >=20
**Lifecycle:** Adopted
**License:** MIT-style Node.js license
**Lock file ref:** `package.json:38`
**Rationale:** Node.js supports the package distribution and subprocess model used by the CLI.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| Bun | n/a | Not declared in package engines and not covered by tests. |
| Deno | n/a | Would require different package and CLI conventions. |

**Upgrade policy:** Raising minimum Node version requires SRS compatibility update.

### TS-FW-03 commander

**Layer:** CLI framework
**Version (pinned):** 14.0.3 installed
**Lifecycle:** Adopted
**License:** MIT
**Lock file ref:** `package-lock.json:1618`
**Rationale:** `commander` provides argument parsing, subcommands, help text, aliases, and unknown option forwarding needed by `dsw`.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| yargs | n/a | Larger surface than needed for the current command set. |
| Manual parsing | n/a | Higher risk of inconsistent help and argument handling. |

**Upgrade policy:** Patch/minor allowed with integration test pass; major requires help and forwarding tests.

### TS-BUILD-04 TypeScript Compiler

**Layer:** Build
**Version (pinned):** 5.9.3 installed
**Lifecycle:** Adopted
**License:** Apache-2.0
**Lock file ref:** `package-lock.json:2962`, `tsconfig.build.json:1`
**Rationale:** `tsc` emits CommonJS files consumed by `bin/dsw`; build output is constrained to runtime `src` files for npm packaging.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| esbuild | n/a | Bundle output is unnecessary for this small CLI. |

**Upgrade policy:** Patch/minor after `npm run typecheck`, `npm run build`, and `npm pack --dry-run`.

### TS-TEST-05 Vitest

**Layer:** Test framework
**Version (pinned):** 4.1.5 installed
**Lifecycle:** Adopted
**License:** MIT
**Lock file ref:** `package-lock.json:3094`
**Rationale:** Vitest runs fast Node unit and integration specs with TypeScript support.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| Jest | n/a | Heavier setup for current TypeScript ESM/CJS mix. |

**Upgrade policy:** Patch/minor with complete test pass.

### TS-TEST-06 tsx

**Layer:** Dev/test execution
**Version (pinned):** 4.21.0 installed
**Lifecycle:** Adopted
**License:** MIT
**Lock file ref:** `package-lock.json:2928`
**Rationale:** `tsx` runs TypeScript entry points and fake Devin scripts during tests without a build step.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| ts-node | n/a | Existing integration tests are already wired to `tsx`. |

**Upgrade policy:** Patch/minor with integration tests.

### TS-BUILD-07 ESLint

**Layer:** Lint
**Version (pinned):** 9.39.4 installed
**Lifecycle:** Adopted
**License:** MIT
**Lock file ref:** `package-lock.json:1753`
**Rationale:** ESLint enforces baseline JavaScript and TypeScript rules before release.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| Biome | n/a | No current repo config or tests use it. |

**Upgrade policy:** Patch/minor with `npm run lint`.

### TS-BUILD-08 typescript-eslint

**Layer:** Type-aware linting
**Version (pinned):** 8.59.2 installed
**Lifecycle:** Adopted
**License:** MIT
**Lock file ref:** `package-lock.json:2975`
**Rationale:** Provides TypeScript lint rules, including no explicit `any`.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| ESLint JS only | n/a | Would miss TypeScript-specific lint checks. |

**Upgrade policy:** Patch/minor with lint pass.

### TS-SEC-09 Devin CLI

**Layer:** External auth/process dependency
**Version (pinned):** Not pinned by repo; must be available on `PATH`
**Lifecycle:** Adopted
**License:** External/proprietary dependency
**Lock file ref:** n/a
**Rationale:** `dsw` exists to invoke and isolate the Devin CLI; it does not implement auth itself.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| Direct Devin API integration | n/a | Not present in current code and would increase secret handling surface. |

**Upgrade policy:** Validate with fake shim and smoke-test real `devin --version` through `dsw doctor`.

### TS-DATA-10 Local JSON Store

**Layer:** Persistence
**Version (pinned):** Store file `version: 1`
**Lifecycle:** Adopted
**License:** n/a
**Lock file ref:** `src/core/store.ts:18`
**Rationale:** A single local JSON file is enough for a single-operator CLI and keeps install requirements minimal.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| SQLite | n/a | More complexity than current account metadata requires. |
| OS keychain | n/a | Devin owns actual credentials; `dsw` stores metadata only. |

**Upgrade policy:** Schema changes require migration logic and SRS/test updates.

### TS-INFRA-11 node-pty

**Layer:** Terminal automation
**Version (pinned):** Not pinned by repo; must be available on `PATH`
**Lifecycle:** Adopted
**License:** ISC-style node-pty license
**Lock file ref:** n/a
**Rationale:** Devin's `/usage` command is interactive and must execute under each managed account profile, so `dsw quota` uses hidden node-pty sessions to send `/usage` and capture terminal output without using the default Devin credential.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| `devin -p "/usage"` | n/a | Uses the default credential path instead of the per-account `dsw` profile in observed behavior. |
| Direct Devin private API | n/a | Not documented in the repo and would increase auth/secret handling scope. |
| Expect-style automation | n/a | Adds another dependency while node-pty is already broadly available and user-approved. |

**Upgrade policy:** Doctor must continue to detect node-pty availability; quota integration tests must pass; default install must not run OS package managers.

### TS-PKG-12 npm Package

**Layer:** Distribution
**Version (pinned):** `@itsddvn/dsw@0.4.1`
**Lifecycle:** Adopted
**License:** Public npm package; source repository license is not declared in `package.json`.
**Lock file ref:** `package.json:2`, `package.json:3`, `package.json:13`, `package.json:16`, `package-lock.json:2`
**Rationale:** A scoped npm package enables `npm install -g @itsddvn/dsw` while preserving the short `dsw` binary name and enabling npm-backed `dsw update`.
**Alternatives considered:**

| Option | Version | Why rejected |
|--------|---------|--------------|
| Unscoped `dsw` package | n/a | Existing public package name is unrelated and unavailable for this project. |
| Git-only install | n/a | Requires checkout/link workflow and does not support normal global npm updates. |

**Upgrade policy:** Release requires package/lock version parity, `npm pack --dry-run`, and verification that packaged `bin/dsw` resolves to `dist/src/cli/index.js`.

## 5. Version Pin Strategy

| Category | Pin Style | Reason |
|----------|-----------|--------|
| Runtime | Minimum version in `engines` | Allows supported Node.js 20+ patch/minor releases. |
| npm dependencies | npm lock file | Reproducible local install. |
| External Devin CLI | Runtime detection | User controls installed Devin binary. |
| node-pty optional package | Runtime detection | npm optional dependency owns node-pty installation and patch cadence. |
| Store schema | Numeric store version | Enables future migration. |
| Package version | `package.json` plus lock-file root | Keeps npm publish, `dsw update`, and release docs aligned. |

## 6. Lock File Inventory

| File | Path | Tool | Last regen |
|------|------|------|-----------|
| `package-lock.json` | `./package-lock.json` | npm | 2026-05-07; root metadata matches `package.json`. |

Lock files MUST be committed. Root package name/version drift is release-blocking.

## 7. License Inventory

| License | Count | Notes |
|---------|------:|-------|
| MIT / Apache-style / permissive | Many | npm dependencies appear typical permissive packages; run `npm ls --json` or a license scanner before distribution. |
| Proprietary / external | 1 | Devin CLI availability and license are outside this repo. |
| Permissive system tools | 1 | node-pty is an external system dependency used for terminal automation. |

Forbidden licenses: none documented in code.

## 8. Supply Chain & Security

- `npm install` should honor `package-lock.json`.
- `npm audit` or an equivalent scanner should run before public release.
- `npm pack --dry-run` should show only runtime package files: `bin`, `dist/src`, `node-pty optional dependency`, `README.md`, and `package.json`.
- Credentials remain owned by the Devin CLI under profile data dirs; `dsw` only isolates where Devin writes them.

---

## Traceability

### TS -> PRD

| TS ID | PRD section |
|-------|-------------|
| `TS-LANG-01` | PRD section 3 |
| `TS-RT-02` | PRD section 6 |
| `TS-FW-03` | PRD section 4 |
| `TS-BUILD-04` | PRD section 6 |
| `TS-TEST-05` | PRD section 6 |
| `TS-TEST-06` | PRD section 6 |
| `TS-BUILD-07` | PRD section 6 |
| `TS-BUILD-08` | PRD section 6 |
| `TS-SEC-09` | PRD section 4.2, section 4.4, section 4.5 |
| `TS-DATA-10` | PRD section 5.1 |
| `TS-INFRA-11` | PRD section 4.1, section 4.6 |
| `TS-PKG-12` | PRD section 4.6 |

### TS -> ARCHITECTURE component dependencies

| TS ID | Components that use it |
|-------|------------------------|
| `TS-LANG-01` | `C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `C-06`, `C-07` |
| `TS-RT-02` | `C-01`, `C-06`, `C-07` |
| `TS-FW-03` | `C-01` |
| `TS-BUILD-04` | `C-06` |
| `TS-TEST-05` | `C-06` |
| `TS-TEST-06` | `C-06` |
| `TS-BUILD-07` | `C-06` |
| `TS-BUILD-08` | `C-06` |
| `TS-SEC-09` | `C-04`, `C-05` |
| `TS-DATA-10` | `C-02` |
| `TS-INFRA-11` | `C-01`, `C-07` |
| `TS-PKG-12` | `C-01`, `C-06` |

### TS -> NFR / BR

| TS ID | NFR/BR |
|-------|--------|
| `TS-SEC-09` | `BR-SEC-01`, `NFR-SEC-001` |
| `TS-DATA-10` | `BR-DATA-01`, `NFR-REL-001` |
| `TS-TEST-05` | `NFR-MAINT-001` |
| `TS-INFRA-11` | `BR-OPS-03`, `NFR-COMPAT-002` |
| `TS-PKG-12` | `BR-OPS-02`, `BR-OPS-04`, `FR-OPS-002`, `FR-OPS-003`, `FR-OPS-005` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added node-pty as the terminal automation dependency for quota reporting. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial brownfield extraction from manifests and config files. |
| 1.2.0 | 2026-05-07 | itsddvn | Added npm package distribution, build-package config, and resolved lock metadata drift. |
