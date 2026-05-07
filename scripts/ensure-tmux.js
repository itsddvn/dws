#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

function main() {
  if (hasCommand('tmux')) {
    const version = spawnSync('tmux', ['-V'], { encoding: 'utf8' }).stdout.trim();
    console.log(`[dsw] tmux found${version ? `: ${version}` : ''}`);
    return;
  }

  if (process.env.CI === 'true' || process.env.DSW_SKIP_TMUX_INSTALL === '1') {
    warnManualInstall();
    return;
  }

  const installer = detectInstaller();
  if (!installer) {
    warnManualInstall();
    return;
  }

  console.log(`[dsw] tmux not found. Installing with: ${installer.command} ${installer.args.join(' ')}`);
  const result = spawnSync(installer.command, installer.args, { stdio: 'inherit' });
  if (result.status === 0 && hasCommand('tmux')) {
    console.log('[dsw] tmux installed.');
    return;
  }

  warnManualInstall();
}

function hasCommand(command) {
  return spawnSync('sh', ['-c', `command -v ${shellQuote(command)} >/dev/null 2>&1`], { stdio: 'ignore' }).status === 0;
}

function detectInstaller() {
  if (process.platform === 'darwin' && hasCommand('brew')) {
    return { command: 'brew', args: ['install', 'tmux'] };
  }

  if (process.platform === 'linux') {
    if (hasCommand('apt-get')) return sudoOrRoot(['apt-get', 'install', '-y', 'tmux']);
    if (hasCommand('dnf')) return sudoOrRoot(['dnf', 'install', '-y', 'tmux']);
    if (hasCommand('yum')) return sudoOrRoot(['yum', 'install', '-y', 'tmux']);
    if (hasCommand('pacman')) return sudoOrRoot(['pacman', '-S', '--noconfirm', 'tmux']);
    if (hasCommand('apk')) return sudoOrRoot(['apk', 'add', 'tmux']);
  }

  return null;
}

function sudoOrRoot(parts) {
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    const [command, ...args] = parts;
    return { command, args };
  }
  if (hasCommand('sudo')) return { command: 'sudo', args: parts };
  return null;
}

function warnManualInstall() {
  console.warn('[dsw] tmux is required for `dsw quota`.');
  console.warn('[dsw] Install it manually: macOS `brew install tmux`, Debian/Ubuntu `sudo apt-get install -y tmux`.');
}

function shellQuote(value) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

main();
