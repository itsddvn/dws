# Phase 2: Project Foundation

## Context Links

- [Plan Overview](./plan.md)
- [Product And Technical Design](./phase-01-product-and-technical-design.md)

## Overview

Priority: P1
Status: Completed
Goal: scaffold repo structure, persistence, config resolver, CLI entrypoint, local service, and test harness. After this phase, `dsw --help` runs and an empty DB is created on first use.

## Requirements

- Node 20 + TypeScript strict project.
- Monorepo-friendly single-package layout.
- SQLite with explicit migration runner.
- CLI entrypoint `dsw` (shebang in `bin/`).
- Local HTTP service bound to `127.0.0.1` with a stubbed `/api/health`.
- Test framework (Vitest).
- Lint + typecheck scripts.
- Paths follow XDG Base Directory spec.

## Architecture

Project layout:

```text
bin/
  dsw                     thin launcher -> dist/cli/index.js
src/
  cli/
    index.ts              argv parser + subcommand dispatcher
    commands/             one file per subcommand (stub OK here)
  server/
    index.ts              fastify/hono app, 127.0.0.1, token middleware
    routes/health.ts      initial stub
  core/
    accounts/
    profiles/
    runner/
    quota/
    scheduler/
    events/
  db/
    client.ts             SQLite connection
    migrations/
      001_init.sql        empty tables from Phase 1 schema
    runner.ts             forward-only migrations, checksum guard
    redact.ts
  config/
    paths.ts              XDG resolver, respects $XDG_DATA_HOME/$XDG_CONFIG_HOME
    settings.ts           load/save settings row
tests/
  unit/
  integration/            spawn CLI in tmp dirs
scripts/
  capture-quota.py        mitmproxy addon (placeholder until Phase 1 spike result)
```

Dependencies to evaluate:

- SQLite: start with `better-sqlite3` (sync API simpler) unless Node 22 LTS with `node:sqlite` is available on user machine.
- HTTP: `hono` (small) or `fastify` (ecosystem). Decide in Phase 2 kickoff.
- CLI arg parser: `cac` or `commander`.
- Process supervision: `execa` for child spawns.
- Testing: `vitest` + `tempy` for tmp dirs.

## Related Code Files

Create:

- `/Users/itsddvn/projects/devin-switcher/package.json`
- `/Users/itsddvn/projects/devin-switcher/tsconfig.json`
- `/Users/itsddvn/projects/devin-switcher/vitest.config.ts`
- `/Users/itsddvn/projects/devin-switcher/.eslintrc.cjs` or `eslint.config.js`
- `/Users/itsddvn/projects/devin-switcher/bin/dsw`
- `/Users/itsddvn/projects/devin-switcher/src/` (structure above)
- `/Users/itsddvn/projects/devin-switcher/tests/`

## Implementation Steps

1. `npm init` and add TS, Vitest, lint, selected HTTP + SQLite libs.
2. Add `tsconfig.json` with `strict: true`, `moduleResolution: "bundler"`, `noUncheckedIndexedAccess: true`.
3. Scaffold dir layout and stub files.
4. Implement `config/paths.ts` with XDG + override envs (`DSW_DATA_HOME`).
5. Implement `db/client.ts` + migration runner with checksum guard.
6. Create migration `001_init.sql` with schema from Phase 1.
7. Implement CLI dispatcher + `dsw --help` + `dsw doctor` stub.
8. Implement local server with `/api/health` returning `{ ok: true }` and UI token middleware stub.
9. Add Vitest harness + one smoke test: "migration creates all tables in a tmp dir."
10. Add npm scripts: `typecheck`, `lint`, `test`, `build`, `dev`.

## Todo List

- [x] `package.json` with selected deps.
- [x] `tsconfig.json` strict.
- [x] Folder scaffold.
- [x] XDG paths util.
- [x] SQLite client + migration runner.
- [x] Init migration.
- [x] CLI shell + `doctor` stub + `--help`.
- [x] Local server + `/api/health` + token stub.
- [x] Vitest harness + smoke test.
- [x] Lint/typecheck/test scripts green.

## Success Criteria

- `npm run typecheck` passes. Done.
- `npm test` runs with at least one green test. Done.
- `bin/dsw --help` prints subcommands. Done.
- `bin/dsw doctor` creates app DB and exits 0. Done, verified in temp XDG dirs.
- `bin/dsw ui --port 0` starts server; `/api/health` returns 200. Done.

## Risk Assessment

- **Native SQLite install friction.** Mitigation: `better-sqlite3` has prebuilt binaries; verify on user's macOS arch first.
- **Server port collisions.** Mitigation: default to port 0 (random), print allocated port; persist in settings for reconnect.

## Security Considerations

- App data dir created with `0700`.
- DB file `0600`.
- `ui-token` generated at first run with 32 bytes random, `0600`.
- Server middleware rejects requests from non-loopback addresses even if binding leaks.

## Next Steps

Implement profile and credential management (Phase 3).
