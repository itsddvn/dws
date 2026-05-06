# Run Mode Observability

## Status

No live run-mode capture was performed in this Phase 1 execution.

Reason:

- Avoid consuming real Devin quota for probing.
- Structured finish signals are not documented as stable CLI output.

Implementation decision:

```text
Treat structured finish_reason as opportunistic.
All supported run modes must work with stdout/stderr fallback.
```

## Matrix

| Devin Run Mode | Structured Signal Status | V1 Parser |
|---|---|---|
| `devin -p` | Unknown | stdout/stderr fallback |
| interactive `devin` | Unknown | stdout/stderr fallback |
| `devin acp` | Not yet verified | JSON-RPC parser only after fixture/live proof |

## Phase 4 Requirement

Business logic must expose a generic signal ingestion API:

```ts
type RunnerSignal =
  | { type: 'finish_reason'; value: string }
  | { type: 'output_line'; value: string }
  | { type: 'exit'; code: number | null };
```

The quota state machine consumes signals independent of where they came from.

## Phase 6 Validation

Phase 6 added deterministic shim coverage for structured `finish_reason` parsing and fallback output handling. The shim proves:

- top-level JSON `finish_reason: quota_exhausted` marks the profile limited;
- JSON-RPC-style `params.finish_reason` is parsed by the shared stream parser;
- `Turn limit reached` stays informational;
- `Rate limited:` records a cooldown without marking the profile limited.

Phase 6 also added a gated live suite and manual checklist for:

```bash
dsw run primary -- -p "reply ok"
dsw run primary -- "interactive prompt"
devin acp
```

For each mode, record:

- Whether structured finish reason is visible.
- Whether output fallback sees quota/auth/rate-limit text.
- Whether session summary is persisted correctly.

Until live captures prove mode-specific behavior, structured parsing remains optional and all run modes must retain stdout/stderr fallback behavior.
