#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.argv[2] || 'D:/codex_project/Heart_JS';
const OUTPUT = path.join(ROOT, 'release', 'win-unpacked');

console.log('Cleaning output...');
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
fs.mkdirSync(OUTPUT, { recursive: true });

console.log('Copying Electron runtime...');
const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
fs.cpSync(electronDist, OUTPUT, { recursive: true, force: true });

const resourcesDir = path.join(OUTPUT, 'resources');
const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
fs.mkdirSync(unpackedDir, { recursive: true });

console.log('Copying app resources...');
fs.cpSync(path.join(ROOT, 'dist-electron'), OUTPUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dist'), path.join(unpackedDir, 'dist'), { recursive: true, force: true });
fs.copyFileSync(path.join(ROOT, 'server.cjs'), path.join(unpackedDir, 'server.cjs'));
fs.copyFileSync(path.join(ROOT, 'server.cjs'), path.join(resourcesDir, 'server.cjs'));

// Copy node_modules (needed for peerjs server)
console.log('Copying node_modules...');
const nodeModulesSrc = path.join(ROOT, 'node_modules');
const nodeModulesDst = path.join(resourcesDir, 'node_modules');
fs.mkdirSync(nodeModulesDst, { recursive: true });
fs.cpSync(nodeModulesSrc, nodeModulesDst, { recursive: true, force: true });

// Create package.json
const pkgJson = JSON.stringify({ name: 'heart-js', version: '0.0.0', main: 'main.js' }, null, 2);
fs.writeFileSync(path.join(OUTPUT, 'package.json'), pkgJson);

console.log('\nBuild complete!');
console.log('Output:', OUTPUT);
console.log('EXE:', path.join(OUTPUT, 'electron.exe'));
