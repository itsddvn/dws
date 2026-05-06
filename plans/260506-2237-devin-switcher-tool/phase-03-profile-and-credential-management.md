# Phase 3: Profile And Credential Management

## Context Links

- [Research Report](./reports/research-report.md)
- [Research Addendum: Quota Model](./reports/research-addendum-quota-model.md)
- [Product And Technical Design](./phase-01-product-and-technical-design.md)
- [Project Foundation](./phase-02-project-foundation.md)

## Overview

Priority: P1
Status: Completed
Goal: make profiles real. User can add, login, import, and inspect profiles. Devin CLI runs under profile XDG env without touching global credentials. First-run wizard imports the existing global account as Profile #1.

## Requirements

- Create/remove profile dirs.
- Import the existing global credential (`dsw import-global` and first-run wizard).
- Launch `devin auth login` inside a profile (inherits TTY, opens browser).
- Parse `devin auth status` output per profile (tier, plan, team, email) without leaking secrets.
- Refuse to run if profile credential is missing/expired; surface `needs_login`.
- Never modify the global credential file under normal operation.

## Architecture

Profile layout:

```text
~/.local/share/devin-switcher/
  app.db
  ui-token
  profiles/
    <profile-id>/
      data/devin/credentials.toml       (0600)
      data/devin/cli/                   (0700)
      config/devin/config.json          (0600)
```

Profile env builder:

```ts
function profileEnv(profileId: string): NodeJS.ProcessEnv {
  const base = paths.profileDir(profileId);
  return {
    ...process.env,
    XDG_DATA_HOME: join(base, 'data'),
    XDG_CONFIG_HOME: join(base, 'config'),
    // Leave HOME alone; Devin doesn't need it changed.
  };
}
```

Credential import rules:

- Global import: `fs.cp(globalCredPath, profileCredPath, { preserveTimestamps: false })`, then `chmod 0600`.
- Global file is opened read-only, never written.
- Import refuses if target exists unless `--force`.

## Related Code Files

Create/modify:

- `/Users/itsddvn/projects/devin-switcher/src/core/profiles/paths.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/profiles/env.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/profiles/import.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/profiles/auth-status.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/profiles/login.ts`
- `/Users/itsddvn/projects/devin-switcher/src/core/accounts/service.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/add.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/login.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/import-global.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/list.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/remove.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/enable.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/disable.ts`
- `/Users/itsddvn/projects/devin-switcher/src/cli/commands/wizard.ts` (first-run)
- `/Users/itsddvn/projects/devin-switcher/src/db/queries/accounts.ts`

## Implementation Steps

1. Implement `profiles/paths.ts` (resolve, create with `0700`).
2. Implement `profiles/env.ts` (env builder + guard against empty profileId).
3. Implement `profiles/import.ts` for global credential import; idempotent with checksum check.
4. Implement `profiles/login.ts` to spawn `devin auth login` with inherited stdio and profile env; wait for exit; time out after 5 min.
5. Implement `profiles/auth-status.ts` to run `devin auth status`, parse tier/plan/team, redact credential path from output.
6. Implement `accounts/service.ts` with DB-backed account CRUD; enforce unique name; compute next `order_index`.
7. Implement `cli/commands/wizard.ts` invoked automatically when `app.db` has zero accounts AND global credential exists.
8. Implement `add`, `login`, `import-global`, `list`, `remove`, `enable`, `disable`.
9. Tests using `tempy` + env overrides; create fake global credential, verify import yields correct perms and DB row; verify env builder paths.
10. Test: after import + `auth status`, global `~/.local/share/devin/credentials.toml` bytes are unchanged (compare sha256).

## Todo List

- [x] Profile dir create/remove with correct perms.
- [x] Profile env builder.
- [x] Global credential import + checksum verification.
- [x] `devin auth login` launcher with TTY inheritance.
- [x] `devin auth status` parser with redaction.
- [x] Account DB service with ordering.
- [x] First-run wizard trigger and flow.
- [x] CLI commands: add/login/import-global/list/remove/enable/disable.
- [x] Unit + integration tests.

## Success Criteria

- `dsw import-global primary` creates profile #1 pointing at a copy of the global credential; `dsw list` shows tier/plan/email. Implemented; live import not run against real account in this session.
- `dsw add secondary` walks user through `devin auth login` in the secondary profile; new JWT lands in `profiles/<id>/data/devin/credentials.toml`. Implemented; browser login not run in this session.
- After all operations above, sha256 of `~/.local/share/devin/credentials.toml` is unchanged. Covered by isolated credential import test.
- `dsw list` never prints `windsurf_api_key` or JWT prefix. Implemented by metadata-only list output.
- Removing a profile deletes its dir and DB row atomically (best effort; document atomicity guarantees). Implemented best-effort DB delete then filesystem delete.
- First run with an empty DB prompts the wizard automatically; user can decline. Implemented for root `dsw` and explicit `dsw wizard`.

## Risk Assessment

- **Devin credential schema changes** in future versions. Mitigation: treat file as opaque; only read existence and mtime unless auth status says otherwise.
- **Interactive login pipe issues** (TTY not forwarded). Mitigation: use `stdio: 'inherit'` in child spawn; do not pipe stdout.
- **Importing the global credential while Devin is running globally** could confuse the user. Mitigation: print a note that both profiles share the same JWT until the user logs in separately.

## Security Considerations

- `credentials.toml` perms `0600`; `profiles/<id>` dir `0700`.
- `dsw list` redacts any field that looks like a JWT or starts with `devin-session-token$`.
- Logs never include env dumps.
- Remove command requires confirmation; prompts the user to type the profile name.

## Next Steps

Implement selection, quota, and runner logic (Phase 4).
