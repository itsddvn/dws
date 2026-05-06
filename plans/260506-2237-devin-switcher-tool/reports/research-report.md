---
title: "Devin CLI Profile Isolation Research"
description: "Research findings for credential switching, quota tracking, and round-robin design for Devin CLI."
created: 2026-05-06
sources: [local-devin-cli, devin-docs, cliproxyapi]
---

# Devin CLI Profile Isolation Research

## Summary

Best architecture: profile sandbox runner.

Do not build V1 as API proxy. Do not replace global credential file as primary path. Devin CLI respects `XDG_DATA_HOME`; each account can run with isolated data/config dirs.

## Findings

### Local Devin CLI

Local binary:

```text
/Users/itsddvn/.local/bin/devin
devin 2026.5.5-0 (7ef98de)
```

Default credential path:

```text
~/.local/share/devin/credentials.toml
```

Credential keys observed:

```text
windsurf_api_key
api_server_url
devin_webapp_host
devin_api_url
```

`devin auth status` reports:

```text
API server:   https://server.codeium.com
Devin webapp: https://app.devin.ai
Devin API:    https://api.devin.ai
```

### XDG Isolation

Test:

```bash
tmp=$(mktemp -d)
XDG_DATA_HOME="$tmp/data" XDG_CONFIG_HOME="$tmp/config" devin auth status
```

Observed:

```text
Not logged in.
Credentials path: $tmp/data/devin/credentials.toml
```

Conclusion: Devin CLI resolves credentials under `XDG_DATA_HOME/devin/credentials.toml`. This enables one profile per account without touching global credential.

### Proxy Support

Official config supports HTTP/SOCKS proxy for CLI outbound traffic:

```json
{
  "proxy": {
    "mode": "manual",
    "url": "http://localhost:8080",
    "no_proxy": "localhost,127.0.0.1"
  }
}
```

Modes:

```text
system | manual | off
```

Scope: CLI HTTP traffic, updates, MCP servers. This is network proxy, not OpenAI-compatible API routing.

Docs:

- https://cli.devin.ai/docs/reference/configuration/config-file
- https://cli.devin.ai/docs/reference/commands

### API Base Override

No official `devin --api-url`, `--base-url`, or config key found in CLI help/docs.

Binary contains env strings:

```text
WINDSURF_API_SERVER_URL
DEVIN_WEBAPP_URL
DEVIN_API_URL
```

Test:

```bash
WINDSURF_API_SERVER_URL=http://127.0.0.1:9 devin auth status
```

Observed: API server is overridden and status fetch fails against localhost. `DEVIN_API_URL` and `DEVIN_WEBAPP_URL` did not affect `auth status` output in the same way.

Conclusion: there are implementation-detail overrides, but no stable official API routing layer for V1.

### CLIProxyAPI Comparison

CLIProxyAPI uses proxy/router architecture:

```text
client -> local API server -> select auth -> upstream
```

Round-robin selector behavior:

- Filter unavailable/disabled/cooldown auths.
- Prefer eligible auths by priority.
- Sort by ID for stable order.
- Keep cursor per `provider:model`.
- On 429/quota errors, mark auth/model unavailable until `NextRecoverAt`.

Relevant sources:

- https://github.com/router-for-me/CLIProxyAPI
- https://github.com/router-for-me/CLIProxyAPI/blob/main/sdk/cliproxy/auth/selector.go
- https://github.com/router-for-me/CLIProxyAPI/blob/main/sdk/cliproxy/auth/conductor.go
- https://github.com/router-for-me/CLIProxyAPI/blob/main/internal/runtime/executor/codex_executor.go

Conclusion: copy the state machine idea, not the proxy architecture.

## Recommended Design

Use isolated profile execution:

```bash
XDG_DATA_HOME=~/.local/share/devin-switcher/profiles/<account>/data \
XDG_CONFIG_HOME=~/.local/share/devin-switcher/profiles/<account>/config \
devin ...
```

Round robin:

```text
eligible profiles = enabled AND not locked AND not limited AND remaining quota > reserve
sort stable by account order
choose next after last selected
spawn devin with profile env
track session duration
on quota/limit signal -> mark limited/cooldown
```

State lives in app DB, not Devin files.

## V1 Scope

Build local app + wrapper:

- Profile import/create.
- Per-account XDG profile dirs.
- Round-robin selector.
- Session timer quota tracking.
- Limit detection from exit/output.
- Manual status overrides.
- Local UI dashboard.

Do not build:

- MITM proxy.
- API-compatible router.
- Global credential replacement primary path.
- Token rewriting.
- Mid-session credential switching.

## Risks

- Quota tracking only accurate when using wrapper.
- Devin may change credential layout.
- Limit output patterns need real samples.
- Concurrent sessions need locks.
- Interactive Devin sessions may not exit soon; quota timer should track active sessions.

## Validation Before Business Logic

1. Create two isolated test profiles.
2. Run `devin auth login` in each profile.
3. Run `devin auth status` per profile.
4. Confirm global `~/.local/share/devin/credentials.toml` unchanged.
5. Run one non-interactive command through profile env.
6. Capture quota/limit error shape when available.
