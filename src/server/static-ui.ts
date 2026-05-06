import type { FastifyInstance } from 'fastify';

export async function registerStaticUiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(INDEX_HTML);
  });

  app.get('/styles.css', async (_request, reply) => {
    return reply.type('text/css; charset=utf-8').send(STYLES);
  });

  app.get('/ui.js', async (_request, reply) => {
    return reply.type('application/javascript; charset=utf-8').send(UI_JS);
  });

  app.get('/favicon.ico', async (_request, reply) => {
    return reply.code(204).send();
  });
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Devin Switcher</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <h1>Devin Switcher</h1>
      <nav>
        <button data-view="accounts" class="active">Accounts</button>
        <button data-view="sessions">Sessions</button>
        <button data-view="settings">Settings</button>
        <button data-view="diagnostics">Diagnostics</button>
      </nav>
    </aside>
    <main>
      <div id="status" class="status">Connecting...</div>
      <section id="view"></section>
    </main>
  </div>
  <script src="/ui.js"></script>
</body>
</html>`;

const STYLES = `
:root {
  color-scheme: light;
  --bg: #f7f7f4;
  --panel: #ffffff;
  --ink: #1d2428;
  --muted: #647076;
  --line: #d9ded9;
  --accent: #0f766e;
  --danger: #b42318;
  --warn: #9a6700;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select { font: inherit; }
.shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; }
.sidebar { border-right: 1px solid var(--line); padding: 20px 14px; background: #fbfbf8; }
h1 { font-size: 18px; margin: 0 0 22px; }
h2 { font-size: 18px; margin: 0 0 14px; }
h3 { font-size: 14px; margin: 0 0 10px; }
nav { display: grid; gap: 6px; }
nav button { border: 0; background: transparent; color: var(--muted); padding: 10px 12px; text-align: left; border-radius: 6px; cursor: pointer; }
nav button.active { color: var(--ink); background: #e8eeeb; }
main { padding: 22px; min-width: 0; }
.status { min-height: 24px; color: var(--muted); font-size: 13px; margin-bottom: 16px; }
.toolbar { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 14px; }
th { color: var(--muted); font-weight: 600; background: #fbfbf8; }
tr:last-child td { border-bottom: 0; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.btn { border: 1px solid var(--line); background: #fff; color: var(--ink); padding: 7px 10px; border-radius: 6px; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.danger { color: var(--danger); }
.badge { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: 999px; padding: 2px 8px; font-size: 12px; color: var(--muted); }
.badge.ready { color: var(--accent); border-color: #8fc9c2; }
.badge.limited, .badge.needs_login { color: var(--danger); border-color: #f0b7b1; }
.bar { height: 8px; min-width: 110px; background: #e9ece8; border-radius: 999px; overflow: hidden; margin-top: 4px; }
.bar > span { display: block; height: 100%; background: var(--accent); }
.muted { color: var(--muted); }
.error { color: var(--danger); }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
label { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
input, select { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; color: var(--ink); background: #fff; min-width: 180px; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.5; }
@media (max-width: 760px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
  nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  main { padding: 14px; }
  table { display: block; overflow-x: auto; }
}`;

const UI_JS = `
const state = { token: sessionStorage.getItem('dswToken') || '', view: 'accounts', settings: {} };
const statusEl = document.getElementById('status');
const viewEl = document.getElementById('view');

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.className = error ? 'status error' : 'status';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function fmtTime(value) {
  if (!value) return 'never';
  return new Date(Number(value) * 1000).toLocaleString();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers['X-Dsw-Token'] = state.token;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function exchangeToken() {
  const url = new URL(location.href);
  const launchToken = url.searchParams.get('t');
  if (launchToken) {
    const result = await fetch('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: launchToken })
    });
    if (!result.ok) throw new Error('UI token exchange failed');
    const body = await result.json();
    state.token = body.token;
    sessionStorage.setItem('dswToken', state.token);
    history.replaceState(null, '', '/');
  }
  if (!state.token) throw new Error('Missing UI token. Start with dsw ui.');
}

function quotaCell(account, key) {
  const value = account[key];
  if (value === null || value === undefined) return '<span class="muted">unknown</span>';
  const width = Math.max(0, Math.min(100, Number(value)));
  return '<div>' + width.toFixed(0) + '%<div class="bar"><span style="width:' + width + '%"></span></div></div>';
}

async function renderAccounts() {
  const accounts = await api('/api/accounts');
  const rows = accounts.map((account) => '<tr>' +
    '<td><strong>' + escapeHtml(account.name) + '</strong><div class="muted">' + escapeHtml(account.email || account.id) + '</div></td>' +
    '<td><span class="badge ' + escapeHtml(account.status) + '">' + escapeHtml(account.status) + '</span><div class="muted">' + escapeHtml(account.status_reason || '') + '</div></td>' +
    '<td>' + quotaCell(account, 'daily_remaining_pct') + '</td>' +
    '<td>' + quotaCell(account, 'weekly_remaining_pct') + '</td>' +
    '<td>' + fmtTime(account.last_used_at) + '</td>' +
    '<td><div class="actions">' +
      '<button class="btn" data-action="refresh-quota" data-id="' + account.id + '">Refresh</button>' +
      '<button class="btn" data-action="' + (account.enabled ? 'disable' : 'enable') + '" data-id="' + account.id + '">' + (account.enabled ? 'Disable' : 'Enable') + '</button>' +
      '<button class="btn" data-action="unmark" data-id="' + account.id + '">Unmark</button>' +
      '<button class="btn danger" data-action="mark-limited" data-id="' + account.id + '">Mark limited</button>' +
    '</div></td>' +
  '</tr>').join('');
  viewEl.innerHTML = '<div class="toolbar"><h2>Accounts</h2><form id="addAccount" class="row"><input name="name" placeholder="Profile name" required><button class="btn primary">Add</button></form></div>' +
    '<table><thead><tr><th>Profile</th><th>Status</th><th>Daily</th><th>Weekly</th><th>Last used</th><th>Actions</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="6" class="muted">No accounts yet.</td></tr>') + '</tbody></table>';
  document.getElementById('addAccount').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('name');
    await api('/api/accounts', { method: 'POST', body: JSON.stringify({ name }) });
    await render();
  });
  viewEl.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      const action = button.dataset.action;
      const body = action === 'mark-limited' ? { reason: 'manual' } : undefined;
      await api('/api/accounts/' + id + '/' + action, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
      await render();
    });
  });
}

async function renderSessions() {
  const sessions = await api('/api/sessions');
  const rows = sessions.map((session) => '<tr>' +
    '<td><strong>' + escapeHtml(session.account_name) + '</strong><div class="muted">' + escapeHtml(session.command_summary || '') + '</div></td>' +
    '<td>' + fmtTime(session.started_at) + '</td>' +
    '<td>' + fmtTime(session.ended_at) + '</td>' +
    '<td>' + escapeHtml(session.finish_reason || session.notes || 'running') + '</td>' +
    '<td>' + escapeHtml(session.exit_code ?? '') + '</td>' +
  '</tr>').join('');
  viewEl.innerHTML = '<h2>Sessions</h2><table><thead><tr><th>Account</th><th>Started</th><th>Ended</th><th>Result</th><th>Exit</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="5" class="muted">No sessions recorded.</td></tr>') + '</tbody></table>';
}

async function renderSettings() {
  state.settings = await api('/api/settings');
  viewEl.innerHTML = '<h2>Settings</h2><form id="settingsForm" class="panel grid">' +
    '<label>Default strategy<select name="default_strategy"><option value="quota-weighted">quota-weighted</option><option value="round-robin">round-robin</option><option value="manual">manual</option></select></label>' +
    '<label>Reserve percent<input name="reserve_pct" type="number" min="0" max="100" step="1"></label>' +
    '<label>Poll interval minutes<input name="poll_interval_minutes" type="number" min="1" step="1"></label>' +
    '<label>Live tail lines<input name="live_tail_lines" type="number" min="20" max="1000" step="10"></label>' +
    '<div class="row"><button class="btn primary">Save</button></div>' +
  '</form>';
  const form = document.getElementById('settingsForm');
  for (const [key, value] of Object.entries(state.settings)) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        default_strategy: formData.get('default_strategy'),
        reserve_pct: Number(formData.get('reserve_pct')),
        poll_interval_minutes: Number(formData.get('poll_interval_minutes')),
        live_tail_lines: Number(formData.get('live_tail_lines'))
      })
    });
    await render();
  });
}

async function renderDiagnostics() {
  const health = await api('/api/health');
  const events = await api('/api/events');
  viewEl.innerHTML = '<h2>Diagnostics</h2><div class="grid"><div class="panel"><h3>Health</h3><pre>' + escapeHtml(JSON.stringify(health, null, 2)) + '</pre></div>' +
    '<div class="panel"><h3>Recent events</h3><pre>' + escapeHtml(JSON.stringify(events.slice(0, 20), null, 2)) + '</pre></div></div>';
}

async function render() {
  setStatus('Loading ' + state.view + '...');
  try {
    if (state.view === 'accounts') await renderAccounts();
    if (state.view === 'sessions') await renderSessions();
    if (state.view === 'settings') await renderSettings();
    if (state.view === 'diagnostics') await renderDiagnostics();
    setStatus('Connected');
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

document.querySelectorAll('nav button').forEach((button) => {
  button.addEventListener('click', async () => {
    state.view = button.dataset.view;
    document.querySelectorAll('nav button').forEach((item) => item.classList.toggle('active', item === button));
    await render();
  });
});

exchangeToken().then(render).catch((error) => setStatus(error.message || String(error), true));
`;
