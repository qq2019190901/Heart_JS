import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import http from 'http';
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

  /**
   * Try to bind the signalling server to `port`.
   * Resolves with the port actually bound, or throws if the port is occupied.
   * Any listener registered by a previous failed attempt is removed first,
   * otherwise stale 'error' handlers would fire on the next attempt.
   */
  const tryListen = (port: number): Promise<number> => {
    return new Promise((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        httpServer.removeListener('listening', onListening);
        reject(err);
      };
      const onListening = () => {
        httpServer.removeListener('error', onError);
        const addr = httpServer.address() as { port: number } | null;
        const actual = addr?.port ?? port;
        console.log(`[PeerJS] Listening on ws://0.0.0.0:${actual}/peerjs?key=peerjs`);
        if (peerServer) peerServer.setPort(actual);
        resolve(actual);
      };
      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(port, '0.0.0.0');
    });
  };

  // 9000 is preferred; fall back to 9001 only when it is genuinely occupied.
  const PREFERRED_PORTS = [9000, 9001];

  (async () => {
    for (const port of PREFERRED_PORTS) {
      try {
        await tryListen(port);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EADDRINUSE') {
          console.warn(`[PeerJS] Port ${port} occupied, trying next...`);
          continue;
        }
        console.error('[PeerJS] Failed to start server:', err);
        return;
      }
    }
    console.error(`[PeerJS] All ports occupied (${PREFERRED_PORTS.join(', ')}), signalling server unavailable`);
  })();
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
