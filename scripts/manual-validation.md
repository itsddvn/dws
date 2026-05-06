# Manual Validation Checklist

Use this checklist for flows that need the real Devin CLI, a browser, or terminal signals. Run from a clean shell on macOS.

## Setup

- [ ] `npm test` passes with `DSW_LIVE` unset.
- [ ] `npm run build` passes.
- [ ] `devin --version` reports the supported CLI version.
- [ ] Record `shasum -a 256 ~/.local/share/devin/credentials.toml` before starting.

## First Run And OAuth

- [ ] Run `dsw wizard` and import the current global login as `primary`.
- [ ] Run `dsw add secondary`; confirm the browser opens for Devin OAuth.
- [ ] Complete login for `secondary`.
- [ ] Run `dsw list`; both profiles show as present and enabled.
- [ ] Confirm profile credential files exist under `~/.local/share/devin-switcher/profiles/<id>/data/devin/credentials.toml`.
- [ ] Confirm profile directories are `0700` and credential files are `0600`.

## CLI Execution

- [ ] Run `dsw run primary -- -p "echo hi"`; command exits successfully.
- [ ] Run `dsw next --strategy round-robin -- -p "echo hi"` twice; selected profiles rotate.
- [ ] Run `dsw mark-limited primary --until-reset`.
- [ ] Run `dsw next --strategy round-robin -- -p "echo hi"`; `primary` is skipped.
- [ ] Run `dsw unmark primary`; `primary` becomes eligible again.

## Signal Handling

- [ ] Confirm structured `finish_reason` is captured for `-p` mode if the Devin CLI prints it.
- [ ] Confirm structured `finish_reason` is captured for `acp` mode if the Devin CLI prints JSON-RPC completion events.
- [ ] For interactive mode, record whether structured completion is visible; if not, document fallback-only behavior in `docs/run-mode-observability.md`.
- [ ] Confirm `Turn limit reached` is not treated as account quota exhaustion.
- [ ] Confirm `Rate limited:` records a cooldown and does not mark the account limited.

## Lock Recovery And Interrupts

- [ ] Start a long-running `dsw run primary -- ...`.
- [ ] Press `Ctrl+C`.
- [ ] Run `dsw doctor`; stale locks are cleaned or reported.
- [ ] If testing hard crashes, kill the child process and confirm the lock is cleaned within 120 seconds or by `dsw doctor`.

## Local UI

- [ ] Run `dsw ui --port 0`.
- [ ] Browser opens to a URL containing a launch token.
- [ ] After load, the token is removed from the address bar.
- [ ] Accounts list renders with status, quota, and session fields.
- [ ] Mark an account limited in the UI; `dsw next` skips it.
- [ ] Unmark the account in the UI; `dsw next` can select it again.
- [ ] Change settings in the UI and refresh; settings persist.

## Credential Isolation

- [ ] Record `shasum -a 256 ~/.local/share/devin/credentials.toml` after all validation.
- [ ] Confirm the before and after hashes match.
- [ ] Search UI output, server responses, and logs for `devin-session-token$`; no credential body appears.
