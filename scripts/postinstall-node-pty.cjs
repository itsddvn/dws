const { spawnSync } = require('node:child_process');

const result = spawnSync('npm', ['rebuild', 'node-pty', '--foreground-scripts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.status !== 0) {
  console.warn('dsw: warning: node-pty rebuild failed; quota/PTY features may be unavailable.');
}
