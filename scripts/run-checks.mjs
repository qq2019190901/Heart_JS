#!/usr/bin/env node
/**
 * Toolchain runner — invokes tsc / vitest / eslint directly through the
 * TypeScript, Vitest and ESLint entry points in node_modules.
 *
 * This exists because the interactive shell is unreliable on this machine;
 * Node itself always works, so we drive the toolchain with Node.
 *
 * Usage: node scripts/run-checks.mjs [tsc|tsc-electron|test|test-verbose|lint|all]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const firstExisting = (candidates) => candidates.find(p => existsSync(p));

const NODE = process.execPath;
const TSC = firstExisting([
  resolve(root, 'node_modules/typescript/bin/tsc'),
  resolve(root, 'node_modules/typescript/lib/tsc.js'),
]);
const VITEST = firstExisting([
  resolve(root, 'node_modules/vitest/vitest.mjs'),
  resolve(root, 'node_modules/vitest/dist/cli.js'),
]);
const ESLINT = firstExisting([
  resolve(root, 'node_modules/eslint/bin/eslint.js'),
]);

const targets = {
  tsc: { bin: TSC, args: ['--noEmit', '-p', 'tsconfig.app.json'] },
  'tsc-electron': { bin: TSC, args: ['--noEmit', '-p', 'tsconfig.electron.json'] },
  test: { bin: VITEST, args: ['run'] },
  'test-verbose': { bin: VITEST, args: ['run', '--reporter=verbose'] },
  'test-watch': { bin: VITEST, args: [] },
  lint: { bin: ESLINT, args: ['.', '--max-warnings', '9999'] },
  'lint-fix': { bin: ESLINT, args: ['.', '--fix'] },
};

const requested = process.argv[2] ?? 'all';
const names = requested === 'all'
  ? ['tsc', 'tsc-electron', 'test', 'lint']
  : [requested];

let failed = 0;
for (const name of names) {
  const spec = targets[name];
  if (!spec) {
    console.log(`\n=== ${name}: UNKNOWN TARGET ===`);
    failed++;
    continue;
  }
  if (!spec.bin) {
    console.log(`\n=== ${name}: BINARY NOT FOUND ===`);
    failed++;
    continue;
  }
  console.log(`\n===== ${name} =====`);
  const res = spawnSync(NODE, [spec.bin, ...spec.args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  const code = res.status ?? 1;
  console.log(`----- ${name}: exit ${code} -----`);
  if (code !== 0) failed++;
}

console.log(`\n######## SUMMARY: ${names.length - failed}/${names.length} passed ########`);
process.exit(failed === 0 ? 0 : 1);
