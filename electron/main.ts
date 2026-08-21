import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import http from 'http';
import { createServer } from 'https';
import { SimplePeerServer } from './peer-server';

let peerHttpServer: http.Server | null = null;
let peerServer: SimplePeerServer | null = null;
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

function startPeerServer() {
  const httpServer = http.createServer();
  peerServer = new SimplePeerServer(httpServer, { path: '/peerjs' });
  peerHttpServer = httpServer;

  const tryListen = (port: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      httpServer.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[PeerJS] Port ${port} occupied, trying ${port + 1}`);
          resolve();
        } else {
          reject(err);
        }
      });
      httpServer.listen(port, '0.0.0.0', () => {
        const addr = httpServer.address() as { port: number };
        console.log(`[PeerJS] Listening on ws://0.0.0.0:${addr.port}/peerjs?key=peerjs`);
        if (peerServer) peerServer.setPort(addr.port);
        resolve();
      });
    });
  };

  tryListen(9000).catch(() => tryListen(9001)).catch((err) => {
    console.error('[PeerJS] Failed to start server:', err);
  });
}

function stopPeerServer() {
  peerServer?.stop();
  if (peerHttpServer) {
    peerHttpServer.close(() => {
      console.log('[PeerJS] Server stopped');
      peerHttpServer = null;
    });
  }
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

function getPreloadPath(): string {
  // preload.js is asarUnpack'd alongside dist/ in packaged mode
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'preload.js'),
    path.join(process.resourcesPath, 'dist-electron', 'preload.js'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '..', 'dist-electron', 'preload.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Cannot find preload.js at any candidate path');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 320,
    minHeight: 480,
    frame: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  });

  mainWindow = win;

  // Start embedded PeerJS signaling server (zero external dependencies)
  startPeerServer();

  // Load the app
  if (app.isPackaged) {
    const indexPath = getDistIndexPath();
    console.log('[Electron] Loading:', indexPath);
    win.loadFile(indexPath);
  } else {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  }

  win.on('ready-to-show', () => {
    win.show();
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  stopPeerServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
