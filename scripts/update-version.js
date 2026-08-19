#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const version = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const versionPath = path.join(__dirname, '..', 'public', 'version.txt');
fs.writeFileSync(versionPath, version + '\n');
console.log('Version:', version);
