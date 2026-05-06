# devin-switcher (`dsw`)

Tiny CLI that lets you keep multiple Devin CLI accounts on one machine and run
`devin` under the account that has the most quota left.

## Install

```bash
npm install
npm run build
npm link        # exposes the `dsw` binary on your PATH
```

Requires Node.js 20+ and the `devin` binary on your `PATH`.

## Commands

| Command                       | What it does                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `dsw [args...]`               | Refreshes quota for every account, picks the one with the most left, runs `devin`. |
| `dsw list` / `dsw ls`         | Lists configured accounts with their quota and last-used time.                     |
| `dsw quota [name] [--raw]`    | Re-runs `devin -p /usage` for one or all accounts and updates the store.           |
| `dsw add <name>`              | Creates a new isolated profile and runs `devin auth login` inside it.              |
| `dsw login <name>`            | Re-runs `devin auth login` for an existing profile (e.g. when the token expires).  |
| `dsw remove <name> --yes`     | Deletes the account record and its on-disk credentials.                            |
| `dsw doctor`                  | Prints local paths and verifies that `devin` is callable.                          |

The default command (`dsw`) forwards any unknown args straight to `devin`, so
`dsw -p "fix bug"` is equivalent to `devin -p "fix bug"` once the right account
has been selected. Pass `--no-refresh` to skip the quota refresh and use the
last cached values.

## How accounts are isolated

Each account gets its own profile directory under
`$DSW_DATA_HOME/devin-switcher/profiles/<id>/`. When `dsw` spawns `devin`, it
sets `XDG_DATA_HOME` and `XDG_CONFIG_HOME` to that profile so `devin auth login`
writes credentials into `<profile>/data/devin/credentials.toml` instead of the
shared global location. Removing an account also removes that directory.

The metadata index lives in
`$DSW_DATA_HOME/devin-switcher/accounts.json` (a plain JSON file you can
inspect or back up).

## Environment variables

| Variable          | Purpose                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `DSW_DATA_HOME`   | Override the data directory root (defaults to `$XDG_DATA_HOME` or `~/.local/share`). |
| `DSW_CONFIG_HOME` | Override the config directory root (defaults to `$XDG_CONFIG_HOME` or `~/.config`).  |

## Development

```bash
npm test          # unit + integration tests (uses a fake `devin` shim)
npm run typecheck
npm run lint
npm run build
```

Integration tests use `scripts/fake-devin.ts` so they never touch your real
Devin credentials.
