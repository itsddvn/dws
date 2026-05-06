# Devin Switcher Usage

Devin Switcher (`dsw`) manages multiple local Devin CLI profiles without rewriting the global Devin credential file during normal runs. Each profile gets its own XDG data/config sandbox.

## Install

Requirements:

- Node 20+
- Devin CLI installed and available as `devin`
- macOS for V1 validation

From this repository:

```bash
npm install
npm run build
npm link
```

Check the local setup:

```bash
dsw doctor
```

## First Run

If you already have a global Devin login, run:

```bash
dsw wizard
```

The wizard can import the current global credential as your first profile, usually named `primary`. Import is a read-only copy from `~/.local/share/devin/credentials.toml` into Devin Switcher's profile directory.

If you do not want to import the global login:

```bash
dsw add primary
```

This creates an isolated profile and launches `devin auth login` inside that profile.

## Add Another Account

```bash
dsw add secondary
```

Complete the Devin browser login. Then verify:

```bash
dsw list
```

## Run Devin With A Specific Profile

Everything after the profile name is passed through to `devin`.

```bash
dsw run primary -- -p "echo hi"
```

Use this when you know which account should handle the run.

## Run The Next Eligible Profile

```bash
dsw next -- -p "echo hi"
```

The default selector is `quota-weighted`: it chooses the eligible account with the highest known remaining quota. Accounts are eligible when they are enabled, not limited, not locked, and logged in or not yet proven invalid.

Other strategies:

```bash
dsw next --strategy round-robin -- -p "echo hi"
dsw next --strategy manual -- -p "echo hi"
```

## Mark Or Clear Limits

Mark a profile limited until you clear it:

```bash
dsw mark-limited primary --until-reset
```

Mark it limited until a known reset time:

```bash
dsw mark-limited primary --until 2026-05-07T00:00:00Z
```

Clear the manual limit:

```bash
dsw unmark primary
```

When a Devin run exposes `finish_reason: quota_exhausted`, `dsw` marks that profile limited automatically. `Turn limit reached` is informational and does not mark the profile limited. `Rate limited:` records a cooldown event while leaving the account ready.

## UI

Start the local UI:

```bash
dsw ui --port 0
```

The server binds to `127.0.0.1` only and opens a browser with a one-time launch token. The UI lets you view accounts, sessions, quota snapshots, update settings, and manually mark or unmark profiles.

## Quota Endpoint

By default, quota handling is fallback-first:

- structured `finish_reason` from Devin output when observable
- known output messages
- manual mark/unmark

If a verified quota endpoint is configured, `dsw` can poll it after runs:

```bash
export DSW_QUOTA_ENDPOINT_URL="https://example.dev/quota"
```

Endpoint polling reads the token from the selected isolated profile credential. It does not read or mutate the global credential.

## Common Errors

`No eligible Devin profiles`

All profiles are disabled, limited, locked, or need login. Run `dsw list`, then `dsw unmark <name>`, `dsw enable <name>`, or `dsw login <name>`.

`Quota endpoint is not configured`

This is normal unless you enabled endpoint polling. Fallback signal detection still works.

`No Devin token found in profile credentials`

Run:

```bash
dsw login <name>
```

`loopback_only`

The UI API rejects non-loopback clients. Open the UI on the same machine at `http://127.0.0.1:<port>`.

## Credential Isolation Check

For manual validation:

```bash
shasum -a 256 ~/.local/share/devin/credentials.toml
dsw run primary -- -p "echo hi"
shasum -a 256 ~/.local/share/devin/credentials.toml
```

The hashes should match.
