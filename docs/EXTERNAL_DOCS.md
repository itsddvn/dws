# External Documents & Resources - devin-switcher

**Version:** 1.2.0
**Date:** 2026-05-07
**Status:** Draft
**Source:** TECHSTACK v1.2.0, ARCHITECTURE v1.3.0
**Owner:** itsddvn

---

## 1. Overview

This registry lists external documents, APIs, specifications, and resources that `devin-switcher` depends on or follows. Entries are pointers only; external content is not copied into this repo.

### 1.1 Relationship to Other Docs

- TECHSTACK lists installed tools and runtime dependencies.
- ARCHITECTURE lists runtime integration points.
- EXTERNAL_DOCS lists where to verify external behavior and documentation.

## 2. Category Index

| Category Code | Meaning | Examples |
|---------------|---------|----------|
| `API` | Third-party API or CLI behavior documentation | Devin CLI auth/run commands |
| `SDK` | Library / SDK reference docs | commander, Vitest, TypeScript |
| `STD` | Standards and platform specs | Node.js, XDG base directories |
| `SVC` | Hosted service documentation | npm registry |
| `REF` | Other reference material | Git documentation |

## 3. External Resources

### 3.1 External APIs and CLIs (`EXT-API`)

#### `EXT-API-001` - Devin CLI

| Field | Value |
|-------|-------|
| **Provider** | Cognition / Devin |
| **URL** | https://docs.devin.ai/ |
| **Version / Revision** | Installed local `devin` binary; verify with `devin --version` |
| **Last Verified** | 2026-05-07 |
| **Type** | API |
| **Why We Depend** | `dsw` invokes `devin auth login`, `devin auth status`, `devin --version`, forwarded Devin commands, and interactive `/usage`. |
| **Cross-refs** | `TS-SEC-09`, `C-04`, `C-07`, `FR-AUTH-001`, `FR-AUTH-002`, `FR-RUN-003`, `FR-RUN-005`, `FR-OPS-001` |
| **Auth / Access** | Paid/authorized Devin CLI account may be required. |
| **Notes / Gotchas** | Auth status and `/usage` output are parsed by regex; real output changes can break metadata extraction or quota reporting. |

### 3.2 SDK and Tool Docs (`EXT-SDK`)

#### `EXT-SDK-001` - commander

| Field | Value |
|-------|-------|
| **Provider** | commander maintainers |
| **URL** | https://github.com/tj/commander.js |
| **Version / Revision** | 14.0.x |
| **Last Verified** | 2026-05-07 |
| **Type** | SDK |
| **Why We Depend** | Provides CLI command parsing, aliases, help, options, and forwarded args. |
| **Cross-refs** | `TS-FW-03`, `C-01`, `FR-CLI-001`, `FR-CLI-002` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Major upgrades can change parsing/help behavior and need integration tests. |

#### `EXT-SDK-002` - TypeScript

| Field | Value |
|-------|-------|
| **Provider** | Microsoft |
| **URL** | https://www.typescriptlang.org/docs/ |
| **Version / Revision** | 5.9.x |
| **Last Verified** | 2026-05-07 |
| **Type** | SDK |
| **Why We Depend** | Source language and compiler for the CLI. |
| **Cross-refs** | `TS-LANG-01`, `TS-BUILD-04`, `C-01`, `C-06`, `NFR-MAINT-002` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Strict compiler options are part of product maintainability. |

#### `EXT-SDK-003` - Vitest

| Field | Value |
|-------|-------|
| **Provider** | Vitest maintainers |
| **URL** | https://vitest.dev/ |
| **Version / Revision** | 4.x |
| **Last Verified** | 2026-05-07 |
| **Type** | SDK |
| **Why We Depend** | Runs unit and integration tests. |
| **Cross-refs** | `TS-TEST-05`, `C-06`, `FR-OPS-003`, `NFR-MAINT-001` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Integration tests depend on Node environment and fake Devin shim. |

#### `EXT-SDK-004` - tsx

| Field | Value |
|-------|-------|
| **Provider** | tsx maintainers |
| **URL** | https://github.com/privatenumber/tsx |
| **Version / Revision** | 4.x |
| **Last Verified** | 2026-05-07 |
| **Type** | SDK |
| **Why We Depend** | Runs TypeScript CLI entry and fake Devin script in tests/dev. |
| **Cross-refs** | `TS-TEST-06`, `C-06`, `TC-RUN-003` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Test runner path is resolved from local `node_modules/.bin/tsx`. |

#### `EXT-SDK-005` - ESLint

| Field | Value |
|-------|-------|
| **Provider** | OpenJS Foundation / ESLint team |
| **URL** | https://eslint.org/docs/latest/ |
| **Version / Revision** | 9.x |
| **Last Verified** | 2026-05-07 |
| **Type** | SDK |
| **Why We Depend** | Lints TypeScript source before release. |
| **Cross-refs** | `TS-BUILD-07`, `TS-BUILD-08`, `C-06`, `FR-OPS-003` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Config uses flat config in `eslint.config.mjs`. |

### 3.3 Standards and Runtime Docs (`EXT-STD`)

#### `EXT-STD-001` - Node.js

| Field | Value |
|-------|-------|
| **Provider** | Node.js project |
| **URL** | https://nodejs.org/api/ |
| **Version / Revision** | Node.js 20+ |
| **Last Verified** | 2026-05-07 |
| **Type** | STD |
| **Why We Depend** | Runtime APIs for fs, path, os, crypto, and child_process. |
| **Cross-refs** | `TS-RT-02`, `C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `NFR-COMPAT-001` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Symlink and filesystem permission behavior can vary by OS. |

#### `EXT-STD-002` - XDG Base Directory behavior

| Field | Value |
|-------|-------|
| **Provider** | freedesktop.org |
| **URL** | https://specifications.freedesktop.org/basedir-spec/latest/ |
| **Version / Revision** | latest as of 2026-05-07 |
| **Last Verified** | 2026-05-07 |
| **Type** | STD |
| **Why We Depend** | `dsw` relies on XDG env variables to isolate where Devin writes data and config. |
| **Cross-refs** | `TS-SEC-09`, `C-03`, `C-04`, `FR-PROF-001`, `BR-SEC-01` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | The spec is a convention; actual behavior depends on Devin CLI honoring it. |

#### `EXT-STD-003` - node-pty

| Field | Value |
|-------|-------|
| **Provider** | node-pty project |
| **URL** | https://github.com/node-pty/node-pty/wiki |
| **Version / Revision** | optional npm package; verify through `dsw doctor` |
| **Last Verified** | 2026-05-07 |
| **Type** | STD |
| **Why We Depend** | `dsw quota` uses detached hidden PTY sessions to drive Devin's interactive `/usage` command under each profile environment. |
| **Cross-refs** | `TS-INFRA-11`, `C-07`, `FR-RUN-005`, `FR-OPS-004`, `NFR-COMPAT-002` |
| **Auth / Access** | Public |
| **Notes / Gotchas** | Installation is npm-managed as an optional dependency; `dsw doctor` remains the diagnostic source. |

### 3.4 Services and Package Resources (`EXT-SVC`)

#### `EXT-SVC-001` - npm registry

| Field | Value |
|-------|-------|
| **Provider** | npm, Inc. / GitHub |
| **URL** | https://docs.npmjs.com/ |
| **Version / Revision** | npm CLI docs current as of 2026-05-07 |
| **Last Verified** | 2026-05-07 |
| **Type** | SVC |
| **Why We Depend** | `dsw update` can run `npm install` or `npm install -g <package>@latest`; npm installs dependencies; public distribution uses `@itsddvn/dsw`. |
| **Cross-refs** | `TS-BUILD-04`, `TS-PKG-12`, `C-01`, `FR-OPS-002`, `FR-OPS-003`, `FR-OPS-005` |
| **Auth / Access** | Public package install; npm auth is required only for publishing. |
| **Notes / Gotchas** | Scoped public packages require public access config on publish; package install resolves the `dsw` binary from `bin/dsw`. |

#### `EXT-SVC-002` - Git

| Field | Value |
|-------|-------|
| **Provider** | Git project |
| **URL** | https://git-scm.com/docs |
| **Version / Revision** | local git CLI |
| **Last Verified** | 2026-05-07 |
| **Type** | SVC |
| **Why We Depend** | Local checkout updates run `git pull --ff-only`. |
| **Cross-refs** | `C-01`, `FR-OPS-002`, `UC-OPS-02` |
| **Auth / Access** | Public docs; repository access depends on remote. |
| **Notes / Gotchas** | Update command stops on non-zero git exit. |

## 4. Link Health Summary

| Status | Count | Action |
|--------|------:|--------|
| Verified (< 3 months) | 10 | None |
| Stale (3-6 months) | 0 | Re-verify at next doc update |
| Expired (> 6 months) | 0 | Re-verify immediately |
| Broken / Moved | 0 | Fix URL or mark deprecated |

## 5. Deprecation & Replacement

| Deprecated `EXT-*` | Reason | Replacement `EXT-*` | Migration Date |
|--------------------|--------|---------------------|----------------|
| n/a | No deprecated external resources documented. | n/a | n/a |

---

## Traceability

| Local ID | Upstream IDs |
|----------|--------------|
| `EXT-API-001` | `TS-SEC-09`, `C-04`, `C-07`, `FR-AUTH-001`, `FR-AUTH-002`, `FR-RUN-003`, `FR-RUN-005`, `FR-OPS-001` |
| `EXT-SDK-001` | `TS-FW-03`, `C-01`, `FR-CLI-001`, `FR-CLI-002` |
| `EXT-SDK-002` | `TS-LANG-01`, `TS-BUILD-04`, `C-01`, `C-06`, `NFR-MAINT-002` |
| `EXT-SDK-003` | `TS-TEST-05`, `C-06`, `FR-OPS-003`, `NFR-MAINT-001` |
| `EXT-SDK-004` | `TS-TEST-06`, `C-06`, `TC-RUN-003` |
| `EXT-SDK-005` | `TS-BUILD-07`, `TS-BUILD-08`, `C-06`, `FR-OPS-003` |
| `EXT-STD-001` | `TS-RT-02`, `C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `NFR-COMPAT-001` |
| `EXT-STD-002` | `TS-SEC-09`, `C-03`, `C-04`, `FR-PROF-001`, `BR-SEC-01` |
| `EXT-STD-003` | `TS-INFRA-11`, `C-07`, `FR-RUN-005`, `FR-OPS-004`, `NFR-COMPAT-002` |
| `EXT-SVC-001` | `TS-BUILD-04`, `TS-PKG-12`, `C-01`, `FR-OPS-002`, `FR-OPS-003`, `FR-OPS-005` |
| `EXT-SVC-002` | `C-01`, `FR-OPS-002`, `UC-OPS-02` |

## Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.1.0 | 2026-05-07 | itsddvn | Added interactive Devin usage and node-pty dependency references for quota reporting. |
| 1.0.0 | 2026-05-07 | itsddvn | Initial external-resource registry for CLI dependencies. |
| 1.2.0 | 2026-05-07 | itsddvn | Updated npm package and node-pty opt-in installer references for public scoped distribution. |
