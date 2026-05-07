# devin-switcher (`dsw`)

Tiny CLI that lets you keep multiple Devin CLI accounts on one machine and
rotates between them so no single account gets exhausted.

## Install

```bash
npm install
npm run build
npm link        # exposes the `dsw` binary on your PATH
```

Requires Node.js 20+ and the `devin` binary on your `PATH`.

## Commands

| Command                         | What it does                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `dsw [args...]`                 | Picks the least-recently-used account and runs `devin` under it. Forwards args to `devin`.    |
| `dsw next [args...]`            | Picks the next ready account in configured list order and runs `devin` under it.              |
| `dsw list` / `dsw ls`           | Lists configured accounts with status, plan, and last-used time.                              |
| `dsw add [name]`                | Creates a new isolated profile and runs `devin auth login` inside it.                         |
| `dsw login <name>`              | Re-runs `devin auth login` for an existing profile (e.g. when the token expires).             |
| `dsw remove <name> --yes`       | Deletes the account record and its on-disk credentials.                                       |
| `dsw update`                    | Updates this install. Git-linked installs pull/build locally; npm installs upgrade globally.  |
| `dsw doctor`                    | Prints local paths and verifies that `devin` is callable.                                     |

The default command (`dsw`) forwards any unknown args straight to `devin`, so
`dsw -p "fix bug"` is equivalent to `devin -p "fix bug"` once the right account
has been selected.

To pick which account to run, `dsw` rotates by **least-recently-used** instead
to spread runs across accounts.

Use `dsw next` when you want explicit list-order rotation instead. It finds the
most recently used account, picks the next ready account from `dsw list`, and
wraps around at the end.

When you run `dsw add` without a name, `dsw` opens `devin auth login`, then
reads `devin auth status` and names the account from the reported Name field,
falling back to the email local-part if Name is unavailable. You can still pass
an explicit name with `dsw add work`.

## How accounts are isolated

Each account gets its own profile directory under
`~/.dsw/profiles/<id>/` by default. This path is independent of the folder where
you run `dsw`, so a global install sees the same accounts from every project.
When `dsw` spawns `devin`, it sets `XDG_DATA_HOME` and `XDG_CONFIG_HOME` to that
profile so `devin auth login` writes credentials into
`<profile>/data/devin/credentials.toml` instead of the shared global location.
Removing an account also removes that directory.

The metadata index lives in `~/.dsw/accounts.json` by default (a plain JSON file
you can inspect or back up).

## Environment variables

| Variable          | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
| `DSW_DATA_HOME`   | Override the data directory root (defaults to `~/.dsw`).                             |
| `DSW_CONFIG_HOME` | Override the config directory root (defaults to the same path as `DSW_DATA_HOME`).   |

## Development

```bash
npm test          # unit + integration tests (uses a fake `devin` shim)
npm run typecheck
npm run lint
npm run build
```

Integration tests use `scripts/fake-devin.ts` so they never touch your real
Devin credentials.
