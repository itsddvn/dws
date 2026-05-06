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
| `dsw list` / `dsw ls`           | Lists configured accounts with status, plan, and last-used time.                              |
| `dsw quota [name] [--open]`     | Prints the Devin usage URL per account; `--open` launches it in your default browser.        |
| `dsw add <name>`                | Creates a new isolated profile and runs `devin auth login` inside it.                         |
| `dsw login <name>`              | Re-runs `devin auth login` for an existing profile (e.g. when the token expires).             |
| `dsw remove <name> --yes`       | Deletes the account record and its on-disk credentials.                                       |
| `dsw doctor`                    | Prints local paths and verifies that `devin` is callable.                                     |

The default command (`dsw`) forwards any unknown args straight to `devin`, so
`dsw -p "fix bug"` is equivalent to `devin -p "fix bug"` once the right account
has been selected.

## Why doesn't `dsw quota` show actual numbers?

The Devin CLI does **not** expose a quota / usage subcommand. The Devin webapp
shows usage at `https://app.devin.ai/org/<id>/settings/usage`, but that page is
a React SPA that fetches data via authenticated browser-session APIs (cookies),
not via the CLI's session token. There is no way to read those numbers without
a logged-in browser.

So `dsw quota` does the next best thing: it prints the per-account usage URL
(using the `org_id` saved by `devin auth login` / `devin setup` into each
profile's `config.json`), and `--open` launches your browser there.

To pick which account to run, `dsw` rotates by **least-recently-used** instead
of trying to reverse-engineer quota.

## How accounts are isolated

Each account gets its own profile directory under
`$DSW_DATA_HOME/devin-switcher/profiles/<id>/`. When `dsw` spawns `devin`, it
sets `XDG_DATA_HOME` and `XDG_CONFIG_HOME` to that profile so `devin auth login`
writes credentials into `<profile>/data/devin/credentials.toml` instead of the
shared global location. Removing an account also removes that directory.

The metadata index lives in `$DSW_DATA_HOME/devin-switcher/accounts.json`
(a plain JSON file you can inspect or back up).

## Environment variables

| Variable          | Purpose                                                                              |
| ----------------- | ------------------------------------------------------------------------------------ |
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
