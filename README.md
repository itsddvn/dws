# devin-switcher (`dsw`)

Tiny CLI that lets you keep multiple Devin CLI accounts on one machine and
rotates between them so no single account gets exhausted.

## Install

Requires Node.js 20+, the `devin` binary on your `PATH`, and optional
`node-pty` support for hidden interactive quota checks and auto-rotate.

### Option 1 — install from npm (recommended)

```bash
npm install -g @itsddvn/dsw
```

`dsw` is now on your `PATH`. Upgrade with `dsw update` (or
`npm install -g @itsddvn/dsw@latest`).

### Option 2 — install from a GitHub checkout

Use this when you want to hack on the code or run an unreleased branch:

```bash
git clone https://github.com/itsddvn/dws.git
cd dws
npm install
npm run build
npm link        # exposes the `dsw` binary on your PATH
```

`dsw update` from a git checkout runs `git pull --ff-only`,
`npm install`, and `npm run build` for you, so subsequent updates are
just `dsw update`.

## Commands

| Command                         | What it does                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `dsw [args...]`                 | Checks quota, picks the best available account, and runs `devin` under it. Forwards args.     |
| `dsw use <name> [args...]`      | Runs `devin` under a specific ready account by name.                                         |
| `dsw list` / `dsw ls`           | Lists configured accounts with status, plan, and last-used time.                              |
| `dsw quota`                     | Runs Devin usage reporting under each ready account and summarizes remaining quota.           |
| `dsw add [name]`                | Creates a new isolated profile and runs `devin auth login` inside it.                         |
| `dsw login <name>`              | Re-runs `devin auth login` for an existing profile (e.g. when the token expires).             |
| `dsw remove <name> --yes`       | Deletes the account record and its on-disk credentials.                                       |
| `dsw update`                    | Updates this install. Git-linked installs pull/build locally; npm installs upgrade globally.  |
| `dsw doctor`                    | Prints local paths and verifies that `devin` is callable.                                     |

The default command (`dsw`) forwards any unknown args straight to `devin`, so
`dsw -p "fix bug"` is equivalent to `devin -p "fix bug"` once the right account
has been selected.

To pick which account to run, `dsw` checks quota first. Default execution picks
the ready account with the highest known remaining quota, using
least-recently-used as the tie-breaker. It skips accounts that need login and
accounts with exhausted or zero remaining quota when another usable account is
available, then updates `lastUsedAt` after selection.

`dsw next` has been removed. The token is reserved and prints a clear removal
error instead of being forwarded to Devin.

Use `dsw use <name>` when you want to bypass rotation and run a specific
account directly. Extra arguments are forwarded to Devin, so
`dsw use work -p "fix bug"` runs `devin -p "fix bug"` with the `work` profile.

Use `dsw quota` to check all managed accounts. It starts a hidden Devin PTY for
each account profile, sends `/usage`, parses the tier, used percentage,
remaining percentage, and reset time when present, skips accounts marked as
needing login, and reports per-account failures without stopping the whole scan.

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
The per-profile `devin/cli` state is linked back to your normal Devin data
directory, so sessions, logs, trusted workspaces, and other CLI state are shared
when `dsw` rotates accounts.

`dsw` also syncs non-auth settings from `~/.config/devin/config.json` into each
profile before running Devin and writes setting changes back afterward. Each
profile keeps its own `devin.org_id`, so account-specific auth metadata does
not leak between accounts. Removing an account also removes its profile
directory.

The metadata index lives in `~/.dsw/accounts.json` by default (a plain JSON file
you can inspect or back up).

## Environment variables

| Variable                     | Purpose                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `DSW_DATA_HOME`              | Override the data directory root (defaults to `~/.dsw`).                                    |
| `DSW_CONFIG_HOME`            | Override the config directory root (defaults to the same path as `DSW_DATA_HOME`).          |
| `DSW_SKIP_QUOTA=1`           | Make `dsw` skip the quota check and pick by least-recently-used instead.                   |
| `DSW_QUOTA_CACHE_TTL_MS`     | Override the quota cache TTL (default 5 minutes). Set `0` to always re-fetch.               |
| `DSW_QUOTA_TIMEOUT_MS`       | Override the per-account quota timeout (default 15s).                                       |
| `DSW_QUOTA_STARTUP_DELAY_MS` | Override how long `dsw quota` waits for the Devin REPL to settle (default 4s).              |
| `DSW_DISABLE_PTY=1`          | Force the legacy subprocess runner and disable interactive auto-rotate.                    |

`dsw` caches quota results under
`~/.dsw/quota-cache.json` so subsequent invocations within the TTL window
skip a fresh hidden PTY probe. `dsw quota` always re-fetches and refreshes the
cache. If the PTY probe is unavailable, default `dsw` warns and falls back to
least-recently-used selection; `dsw quota` exits non-zero because an explicit
quota report should not use stale data.

## Development

```bash
npm test          # unit + integration tests (uses a fake `devin` shim)
npm run typecheck
npm run lint
npm run build
```

Integration tests use `scripts/fake-devin.ts` so they never touch your real
Devin credentials.
