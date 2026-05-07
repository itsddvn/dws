import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface PackageJson {
  name?: string;
  private?: boolean;
  version?: string;
}

export interface UpdateCommandOptions {
  dryRun?: boolean;
}

export async function runUpdate(options: UpdateCommandOptions = {}): Promise<void> {
  const packageRoot = findPackageRoot(__dirname);
  const packageJson = readPackageJson(packageRoot);
  const commands = fs.existsSync(path.join(packageRoot, '.git'))
    ? [
        { command: 'git', args: ['pull', '--ff-only'] },
        { command: 'npm', args: ['install'] },
        { command: 'npm', args: ['run', 'build'] }
      ]
    : npmInstallCommands(packageJson);

  if (options.dryRun) {
    for (const step of commands) {
      console.log([step.command, ...step.args].join(' '));
    }
    return;
  }

  console.log(`Updating dsw${packageJson.version ? ` from ${packageJson.version}` : ''}...`);
  for (const step of commands) {
    console.log(`$ ${[step.command, ...step.args].join(' ')}`);
    const exitCode = await runInherited(step.command, step.args, packageRoot);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
      return;
    }
  }
  console.log('dsw update complete.');
}

function npmInstallCommands(packageJson: PackageJson): Array<{ command: string; args: string[] }> {
  if (!packageJson.name) throw new Error('Cannot update: package.json is missing a package name.');
  if (packageJson.private) {
    throw new Error('Cannot update from npm because this installed package is marked private.');
  }
  return [{ command: 'npm', args: ['install', '-g', `${packageJson.name}@latest`] }];
}

function findPackageRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) return current;
    const parent = path.dirname(current);
    if (parent === current) throw new Error('Cannot locate package.json for dsw.');
    current = parent;
  }
}

function readPackageJson(packageRoot: string): PackageJson {
  const raw = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8');
  return JSON.parse(raw) as PackageJson;
}

function runInherited(command: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
