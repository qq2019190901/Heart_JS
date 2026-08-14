import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let peerServerProcess: ReturnType<typeof spawn> | null = null;
let mainWindow: BrowserWindow | null = null;

// Single-instance lock: prevent multiple windows/instances from spawning
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  // Someone tried to run a second instance — focus the existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function getServerCjsPath(): string {
  // In both packaged and unpacked debug mode:
  // - process.resourcesPath points to <output>/resources
  // - server.cjs is at <output>/resources/server.cjs or <output>/resources/app.asar.unpacked/server.cjs
  const candidates = [
    path.join(process.resourcesPath, 'server.cjs'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
    path.join(__dirname, '..', 'server.cjs'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find server.cjs at any candidate path');
}

function getDistIndexPath(): string {
  // In both packaged and unpacked debug mode, dist/ is in resources/app.asar.unpacked/
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find index.html at any candidate path');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 320,
    minHeight: 480,
    frame: false,
    backgroundColor: '#0d5e28',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow = win;

  // Start embedded PeerJS signaling server
  const serverCjs = getServerCjsPath();
  peerServerProcess = spawn(process.execPath, [serverCjs], {
    stdio: 'pipe',
  });
  peerServerProcess.stdout?.on('data', (d: Buffer) => {
    try { console.log('[PeerJS]', d.toString().trim()); } catch {}
  });
  peerServerProcess.stderr?.on('data', (d: Buffer) => {
    try { console.error('[PeerJS]', d.toString().trim()); } catch {}
  });

  // Load the app
  if (app.isPackaged) {
    const indexPath = getDistIndexPath();
    console.log('[Electron] Loading:', indexPath);
    // In packaged mode, loadURL with asar:// scheme works for loading from asar
    win.loadFile(indexPath);
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded successfully');
  });

  win.webContents.on('console-message', (_event, _level, message) => {
    console.log('[Renderer]', message);
  });

  win.webContents.on('page-favicon-updated', () => {
    console.log('[Electron] favicon updated');
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] Render process gone:', details);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Failed to load:', errorCode, errorDescription, 'URL:', validatedURL);
  });

  win.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('app-exit', () => app.quit());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  peerServerProcess?.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
