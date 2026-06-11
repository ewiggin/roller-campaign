#!/usr/bin/env node
/**
 * Builds the NestJS backend as a self-contained sidecar binary for Tauri.
 *
 * Pipeline: nest build → ncc (single-file JS bundle) → @yao-pkg/pkg (native
 * executable, Node 22 runtime embedded).
 *
 * The output is named with the Rust target triple that Tauri's `externalBin`
 * expects: roller-backend-<triple>[.exe].
 *
 * IMPORTANT: better-sqlite3 and bcrypt are native addons, so the binary can
 * only be built ON the platform it targets (no cross-compilation). CI builds
 * each platform on its own runner; locally you get the host platform only.
 *
 * Usage:
 *   node scripts/build-sidecar.mjs
 *   SIDECAR_OUT_DIR=/custom/path node scripts/build-sidecar.mjs
 */
import { execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HOSTS = {
  'darwin-arm64': { pkgTarget: 'node22-macos-arm64', triple: 'aarch64-apple-darwin', ext: '' },
  'darwin-x64': { pkgTarget: 'node22-macos-x64', triple: 'x86_64-apple-darwin', ext: '' },
  'win32-x64': { pkgTarget: 'node22-win-x64', triple: 'x86_64-pc-windows-msvc', ext: '.exe' },
  'linux-x64': { pkgTarget: 'node22-linux-x64', triple: 'x86_64-unknown-linux-gnu', ext: '' },
  'linux-arm64': { pkgTarget: 'node22-linux-arm64', triple: 'aarch64-unknown-linux-gnu', ext: '' },
};

const hostKey = `${os.platform()}-${os.arch()}`;
const target = HOSTS[hostKey];
if (!target) {
  console.error(`Unsupported host platform: ${hostKey}`);
  process.exit(1);
}

const outDir =
  process.env.SIDECAR_OUT_DIR ??
  path.join(root, '..', 'roller-desktop', 'src-tauri', 'binaries');
const outFile = path.join(outDir, `roller-backend-${target.triple}${target.ext}`);

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit' });
}

rmSync(path.join(root, 'build'), { recursive: true, force: true });

run('npm run build');
run('npx ncc build dist/src/main.js -o build/sidecar');

mkdirSync(outDir, { recursive: true });
run(
  `npx pkg build/sidecar/index.js --config pkg.sidecar.json ` +
    `--target ${target.pkgTarget} --output "${outFile}"`,
);

console.log(`\n✔ Sidecar ready: ${outFile}`);
