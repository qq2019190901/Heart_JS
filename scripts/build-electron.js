#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.argv[2] || 'D:/codex_project/Heart_JS';
const BUILD = path.join(ROOT, '_build', 'win-unpacked');
const OUTPUT = path.join(ROOT, 'release', 'win-unpacked');

console.log('Cleaning output...');
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
}
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

console.log('Copying from electron-builder output...');
fs.cpSync(BUILD, OUTPUT, { recursive: true, force: true });

console.log('\nBuild complete!');
console.log('Output:', OUTPUT);
console.log('EXE:', path.join(OUTPUT, 'Heart JS.exe'));
