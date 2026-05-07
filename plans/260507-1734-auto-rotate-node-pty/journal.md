# Journal - Auto-Rotate Node PTY

2026-05-07:

- Removed the active `dsw next` command and added a removed-token guard so it cannot be forwarded to Devin.
- Replaced quota probing with a hidden `node-pty` transport and retained a test-only `--print` fallback when an injected runner is used.
- Added PTY loader smoke checks, PTY runner/session tracking, input/output/prompt helpers, and a first rotate engine.
- Removed tmux postinstall/package surface and updated README/product docs to node-pty behavior.
- Verified with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
