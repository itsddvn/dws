# Quota Endpoint Spike

## Status

Mode: `fallback-first`, endpoint optional.

No live quota endpoint was captured in this run because `mitmdump` is not installed in the current environment.

This is an acceptable Phase 1 outcome because V1 must not hard-depend on a reverse-engineered/private endpoint. Implementation should ship with fallback signals and enable server polling only after a successful spike.

## Decision

Current implementation mode:

```text
quota_mode = fallback-first
server endpoint polling = disabled until captured and approved
```

Fallback signals:

- Structured `finish_reason == "quota_exhausted"` when observable.
- Literal output `Quota exhausted`.
- Literal output `Upgrade your plan or wait for your quota to reset`.
- Manual `mark-limited`.

Non-exhaustion signals:

- `Turn limit reached` is informational.
- `Rate limited:` is transient cooldown, not full quota exhaustion.

## Spike Tooling

Use `scripts/capture-quota.py` with mitmproxy:

```bash
mitmdump -s scripts/capture-quota.py \
  --set block_global=false \
  --listen-host 127.0.0.1 \
  --listen-port 8080
```

Then run Devin through the proxy:

```bash
HTTPS_PROXY=http://127.0.0.1:8080 \
SSL_CERT_FILE=~/.mitmproxy/mitmproxy-ca-cert.pem \
devin
```

Inside Devin, trigger `/usage`.

## Capture Targets

Capture only metadata and redacted payloads:

- URL host/path
- Method
- Status code
- Request content-type
- Response content-type
- Redacted JSON response

Never store:

- JWT
- Authorization headers
- Cookies
- Full credential file

## Expected Server Fields

Binary research suggests quota payload may contain:

```text
daily_quota_remaining_percent
weekly_quota_remaining_percent
daily_quota_reset_at_unix
weekly_quota_reset_at_unix
used_prompt_credits
available_prompt_credits
used_flow_credits
available_flow_credits
used_flex_credits
available_flex_credits
```

Normalize whatever fields are present. UI hides missing fields.

## Endpoint Enablement Gate

Server polling can be enabled only if all are true:

- Endpoint is captured.
- Response includes quota fields or can be mapped reliably.
- Request can be made with profile credential without mutating files.
- Failure path is tested.
- User accepts private endpoint fragility.

If any condition fails, keep `fallback-first` and disable endpoint polling.

## Run-Mode Signal Matrix

Not yet captured. Required before Phase 4 relies on structured signals.

| Devin Run Mode | Structured `finish_reason` Observable | Fallback |
|---|---:|---|
| `devin -p` | Unknown | stdout/stderr string matching |
| interactive `devin` | Unknown | stdout/stderr string matching |
| `devin acp` | Unknown | JSON-RPC parser if proven |

Phase 6 must add live or shim tests for each supported mode.
