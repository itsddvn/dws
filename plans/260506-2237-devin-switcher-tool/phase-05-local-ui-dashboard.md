# Phase 5: Local UI Dashboard

## Context Links

- [Product And Technical Design](./phase-01-product-and-technical-design.md)
- [Selection And Quota Logic](./phase-04-round-robin-and-quota-logic.md)

## Overview

Priority: P2
Status: Partially Completed
Goal: build a thin local web UI that exposes account, quota, and session state. UI is served by the Node service on `127.0.0.1`. UI is operational, not decorative.

## Requirements

- Accounts dashboard with status, daily/weekly remaining %, last activity.
- Current/active sessions are available through the API; the static UI currently shows a passive session history table.
- Session history.
- Manual override controls (mark-limited, unmark, enable/disable).
- Settings page (poll interval, reserve %, log retention, default strategy).
- Empty / loading / error states for every view.
- Token-based auth via `X-Dsw-Token` (no cookies, no CORS).

## Architecture

Views:

```text
Accounts        -> table per account; row click -> drawer with details + actions
Current Run     -> API support for active session(s), live tail of last 200 lines (redacted)
Sessions        -> finite history with finish_reason badges; static UI detail/live-tail view pending
Settings        -> form bound to /api/settings
Diagnostics     -> output of /api/health + recent events
```

Backend HTTP API (matches Phase 1 contract):

```text
GET  /api/accounts
POST /api/accounts
POST /api/accounts/:id/login
POST /api/accounts/:id/disable
POST /api/accounts/:id/enable
POST /api/accounts/:id/mark-limited
POST /api/accounts/:id/unmark
POST /api/accounts/:id/refresh-quota
DELETE /api/accounts/:id

POST /api/run
GET  /api/sessions
GET  /api/sessions/:id
POST /api/sessions/:id/stop

GET  /api/events
GET  /api/settings
PUT  /api/settings

GET  /api/health
```

Streaming:

- Server-Sent Events (`/api/sessions/:id/stream`) for live tail. SSE keeps the implementation small; redaction applied server-side before pushing.

Frontend stack:

- Dependency-free static HTML/CSS/JS served by Fastify at `/`.
- Client stores the exchanged UI token in `sessionStorage` and sends it as `X-Dsw-Token`.
- No separate frontend build step for V1; `tsc` emits the server-side static UI module into `dist`.

## Related Code Files

Create/modify:

- `/Users/itsddvn/projects/devin-switcher/src/server/routes/accounts.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/routes/sessions.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/routes/events.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/routes/settings.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/middleware/auth.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/middleware/loopback.ts`
- `/Users/itsddvn/projects/devin-switcher/src/server/static-ui.ts`

## Implementation Steps

1. Implement loopback-only middleware (reject if `req.socket.remoteAddress !== '127.0.0.1'`).
2. Implement token middleware reading `~/.local/share/devin-switcher/ui-token`.
3. Implement remaining `/api/*` routes per Phase 1 contract.
4. Implement SSE for live session tail with backpressure-safe writer.
5. Add static UI assets served by Fastify.
6. Build Accounts page (table, drawer, actions).
7. Build Sessions page (list + detail).
8. Build Settings page (form + validation).
9. Build Diagnostics page.
10. Bundle for production; serve static assets from Node.
11. `dsw ui` command opens default browser to `http://127.0.0.1:<port>/?t=<one-shot-token>`; client exchanges it with `POST /api/auth/exchange`, then immediately calls `history.replaceState()` to remove the token from the URL. One-shot token expires after 60s.

## Todo List

- [x] Loopback middleware.
- [x] Token middleware.
- [x] All API routes wired to core services.
- [x] SSE live tail.
- [x] Accounts page.
- [x] Sessions page (passive history table).
- [x] Settings page.
- [x] Diagnostics page.
- [x] Production bundle and static serving.
- [x] `dsw ui` opens browser with auth handshake.
- [ ] Static UI session detail/live-tail view.
- [ ] Static UI run/stop controls.

## Progress Log

### 2026-05-06

- Started Phase 5 backend surface.
- Registered token-protected, loopback-only routes for accounts, sessions, events, and settings.
- Left React UI, SSE live tail, auth exchange, browser launch, and several action routes pending.
- Completed the local dashboard as a dependency-free static UI served by Fastify.
- Added one-shot browser token exchange, immediate URL cleanup in the client, and persistent `X-Dsw-Token` session storage.
- Wired account actions, quota refresh, sessions list/detail/stop, `/api/run`, settings, diagnostics, static assets, and SSE event streaming at the API level.
- Static UI includes accounts, session history, settings, and diagnostics. Session detail/live-tail rendering and run/stop controls remain follow-up UI work.
- Added integration tests for protected API access and one-shot token reuse prevention.

## Success Criteria

- User can manage profiles entirely from UI without using CLI.
- Daily and weekly quota are visualized as bars; values come from latest `quota_snapshot`.
- API exposes active-session live tail with secrets redacted; static UI rendering of that tail remains pending.
- All API endpoints reject requests missing or with wrong `X-Dsw-Token` (HTTP 401).
- All API endpoints reject requests from non-loopback addresses (HTTP 403).
- UI never displays raw JWT or `windsurf_api_key`.
- Manual override actions are reflected in UI within one poll cycle.

## Risk Assessment

- **UI scope creep.** Mitigation: V1 is operational. No theming, no charts beyond simple bars, no notifications.
- **Browser token leakage** through history or extensions. Mitigation: one-shot URL token expires after 60s, is exchanged immediately, URL query is removed with `history.replaceState()`, and persistent token stays in `sessionStorage`.
- **SSE proxy issues** when user reverse-proxies. Out of scope; document loopback-only.

## Security Considerations

- Bind `127.0.0.1` only.
- Reject any host header that resolves elsewhere.
- All response bodies redact JWT-like substrings as a final safety net.
- Token rotation: `dsw doctor --rotate-token` regenerates the file.

## Next Steps

End-to-end validation in Phase 6.
