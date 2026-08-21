import Peer, { type DataConnection } from 'peerjs';
import type { Card } from '../game/types';

export type LanRole = 'host' | 'client' | null;

export type LanEvent =
  | 'connection-ready'
  | 'peer-connected'
  | 'peer-disconnected'
  | 'data-received'
  | 'connection-error';

export type ServerMode = 'embedded' | 'custom' | 'auto';

const SERVER_STORAGE_KEY = 'heart-lan-server';

export interface LanServerConfig {
  host: string;
  port: number;
}

export class LanPeerManager {
  private peer: Peer | null = null;
  private _role: LanRole = 'client';
  private _myId: string = '';
  private _roomId: string = '';
  private hostConn: DataConnection | null = null;
  private guestConns = new Map<string, any>();
  private listeners = new Map<string, Set<(data: any) => void>>();
  private connected = false;
  private serverConfig: LanServerConfig = { host: 'localhost', port: 9000 };
  private _serverPort: number = 9000;
  private _serverMode: ServerMode = 'embedded';
  private _androidLocalIp: string = '';
  private _lanClientPasses: Record<string, Card[]> = {};
  private _isAndroid = false;

  /** Detect if running inside Capacitor/Android WebView */
  private detectAndroid(): boolean {
    if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
      this._isAndroid = true;
      return true;
    }
    // Also detect by checking for native bridge presence (more reliable for Capacitor)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (win.__localIp || win.__serverPort || (win.AndroidBridge && typeof win.AndroidBridge.getLocalIp === 'function')) {
      this._isAndroid = true;
      return true;
    }
    return false;
  }

  /**
   * Resolve server config for the current environment.
   * On Android, polls for the local WiFi IP injected by native code via window.__localIp.
   * Returns the resolved config; the caller must set it via setServerConfig().
   */
  async resolveServerConfig(): Promise<LanServerConfig | null> {
    // Detect Android at call time (navigator not available at construction)
    this.detectAndroid();
    if (!this._isAndroid) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    // Wait for native side to inject IP and actual server port
    for (let i = 0; i < 8; i++) {
      const ip = win.__localIp || (win.AndroidBridge ? win.AndroidBridge.getLocalIp() : undefined);
      const port = win.__serverPort ?? (win.AndroidBridge ? win.AndroidBridge.getServerPort() : -1);
      if (ip && ip !== '127.0.0.1' && port >= 0) {
        const config: LanServerConfig = { host: ip, port };
        this._serverPort = port;
        this.setAndroidLocalIp(ip);
        this.setServerConfig(config);
        console.log(`[LAN-HOST] Android server ready: ${ip}:${port}`);
        return config;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }

  get clientPasses(): Record<string, Card[]> { return this._lanClientPasses; }
  set clientPasses(v: Record<string, Card[]>) { this._lanClientPasses = v; }

  get isConnected() { return this.connected; }
  get role() { return this._role; }
  get myId() { return this._myId; }
  get roomId() { return this._roomId; }
  get hostConnection() { return this.hostConn; }
  get guestConnections() { return new Map(this.guestConns); }
  get serverMode() { return this._serverMode; }
  get androidLocalIp() { return this._androidLocalIp; }
  get isAndroid() { return this._isAndroid; }
  get serverPort() { return this._serverPort; }

  static createPeerId(): string {
    return `p-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Configure the PeerJS server address.
   * Default: localhost:9000
   */
  setServerConfig(config: LanServerConfig): void {
    this.serverConfig = config;
    LanPeerManager.saveServer(config.host, config.port);
  }

  setServerMode(mode: ServerMode): void {
    this._serverMode = mode;
  }

  setAndroidLocalIp(ip: string): void {
    this._androidLocalIp = ip;
  }

  /**
   * Read server config from URL hash (#server=host:port)
   */
  static getServerFromUrl(): { host: string; port: number } | null {
    const match = window.location.hash.match(/#server=([^&]+)/);
    if (match) {
      const [host, port] = match[1].split(':');
      return { host, port: parseInt(port) || 9000 };
    }
    return null;
  }

  /**
   * Read saved server config from localStorage
   */
  static getSavedServer(): { host: string; port: number } | null {
    try {
      const s = localStorage.getItem(SERVER_STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  /**
   * Save server config to localStorage
   */
  static saveServer(host: string, port: number): void {
    localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify({ host, port }));
  }

  /**
   * Build PeerJS options from server config.
   */
  private getPeerOptions(): { host: string; port: number; path: string; secure: boolean } {
    return {
      host: this.serverConfig.host,
      port: this.serverConfig.port,
      path: '/',
      secure: false,
    };
  }

  /**
   * Host: connect to self-hosted PeerJS server.
   * @param myName Display name for this player
   * @param desiredId Optional custom ID to use as room code.
   *                  If unavailable, server auto-assigns one.
   * @returns The actual room ID (may differ from desiredId if taken)
   */
  async initAsHost(myName: string, desiredId?: string): Promise<string> {
    // Auto-detect Android local IP before starting
    const androidCfg = await this.resolveServerConfig();
    if (androidCfg) {
      console.log(`[LAN-HOST] Android detected, using server: ${androidCfg.host}:${androidCfg.port}`);
    }
    return new Promise((resolve, reject) => {
      this._role = 'host';
      const opts = this.getPeerOptions();
      // If desiredId provided, try to use it; otherwise let server auto-assign
      const peerId = desiredId || undefined;
      this.peer = new Peer(peerId as any, {
        ...opts,
        debug: 0,
        config: { iceServers: [] },
      });

        this.peer.on('open', (id) => {
        this._myId = id;
        this._roomId = id;
        this.connected = true;
        // Persist actual server port for clients to read
        try { localStorage.setItem('heart-lan-server-port', String(this._serverPort)); } catch {}
        const note = desiredId && id !== desiredId
          ? ` (requested ${desiredId}, got ${id})`
          : '';
        console.log(`[LAN-HOST] Room ID: ${id}${note} (server: ${this.serverConfig.host}:${this._serverPort})`);
        this.emit('connection-ready', { roomId: id, role: 'host' });

        // Listen for raw WebSocket messages from clients via the server
        // (e.g., JOIN messages when clients connect)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ws = (this.peer as any).socket;
        if (ws) {
          ws.on('message', (data: any) => {
            try {
              const msg = typeof data === 'string' ? JSON.parse(data) : data;
              console.log('[LAN-HOST] Raw server message:', msg.type, 'from:', msg.src || 'server');
              if (msg.type === 'JOIN') {
                const clientId = msg.src || this._myId;
                const clientName = msg.payload?.name || clientId;
                console.log(`[LAN-HOST] Client joined: ${clientName} (${clientId})`);
                this.emit('peer-connected', { id: clientId, name: clientName });
              }
            } catch {}
          });
          console.log('[LAN-HOST] Registered raw WebSocket message listener');
        }

        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleGuestConnection(conn);
      });


      this.peer.on('error', (err) => {
        console.error('[LAN-HOST] Peer error:', err);
        this.emit('connection-error', {});
        reject(err);
      });

      setTimeout(() => {
        if (!this.connected) {
          this.emit('connection-error', {});
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Client: connect to self-hosted PeerJS server, then connect to host by ID.
   * @param hostId The host's PeerJS ID (room code)
   */
  async initAsClient(myName: string, hostId: string, maxRetries: number = 3): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this._initAsClientInner(myName, hostId);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[LAN-CLIENT] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        if (attempt < maxRetries) {
          // Try alternate port before retrying
          this._serverPort = this._serverPort === 9000 ? 9001 : 9000;
          this.serverConfig = { ...this.serverConfig, port: this._serverPort };
          console.log(`[LAN-CLIENT] Switching to port ${this._serverPort} for retry...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.error('[LAN-CLIENT] All attempts failed after', maxRetries, 'retries:', lastError?.message);
    return false;
  }

  private _initAsClientInner(myName: string, hostId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this._role = 'client';
      this._roomId = hostId;

      // Clean up old peer before creating a new one
      if (this.peer) {
        try { this.peer.destroy(); } catch {}
        this.peer = null;
      }

      // Auto-detect server: URL hash > Android native bridge > localStorage > default
      const urlServer = LanPeerManager.getServerFromUrl();
      const savedServer = LanPeerManager.getSavedServer();
      const savedPort = parseInt(localStorage.getItem('heart-lan-server-port') || '', 10);
      console.log('[LAN-CLIENT] initAsClient: isElectron=', !!(window as any).electronAPI,
        'urlServer=', urlServer, 'savedServer=', savedServer, 'savedPort=', savedPort,
        'currentConfig=', this.serverConfig, 'android=', this._isAndroid);

      if (urlServer) {
        this.serverConfig = urlServer;
        console.log('[LAN-CLIENT] Using URL hash server config:', this.serverConfig);
      } else if (this._isAndroid) {
        // Read from native bridge directly (more reliable than resolveServerConfig timeout)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        let nativePort = -1;
        let nativeIp = '';
        if (win.__serverPort !== undefined) {
          nativePort = win.__serverPort;
        } else if (win.AndroidBridge) {
          nativePort = win.AndroidBridge.getServerPort();
        }
        if (win.__localIp) {
          nativeIp = win.__localIp;
        } else if (win.AndroidBridge) {
          nativeIp = win.AndroidBridge.getLocalIp();
        }
        console.log('[LAN-CLIENT] Android native bridge: __serverPort=', nativePort, '__localIp=', nativeIp,
          'AndroidBridge?.getServerPort()=', win.AndroidBridge ? win.AndroidBridge.getServerPort() : 'N/A',
          'AndroidBridge?.getLocalIp()=', win.AndroidBridge ? win.AndroidBridge.getLocalIp() : 'N/A');

        if (nativePort > 0) {
          this.serverConfig = { ...this.serverConfig, port: nativePort };
          this._serverPort = nativePort;
        }
        // Only override host if it's still localhost (user didn't set custom IP)
        if (this.serverConfig.host === 'localhost' || this.serverConfig.host === '127.0.0.1') {
          this.serverConfig = { ...this.serverConfig, host: nativeIp || this._androidLocalIp || 'localhost' };
        }
        console.log('[LAN-CLIENT] Final Android server config:', this.serverConfig);
      } else if (savedServer && savedServer.host !== '127.0.0.1' && savedServer.host !== 'localhost'
        && (this.serverConfig.host === 'localhost' || this.serverConfig.host === '127.0.0.1')) {
        // Only apply savedServer when current config is still default (not externally set)
        this.serverConfig = savedServer;
        console.log('[LAN-CLIENT] Using saved server config:', this.serverConfig);
      }

      // If we have a saved actual port from a previous host session, prefer it
      if (savedPort > 0 && savedPort !== this.serverConfig.port) {
        console.log(`[LAN-CLIENT] Using saved actual port: ${savedPort}`);
        this.serverConfig = { ...this.serverConfig, port: savedPort };
        this._serverPort = savedPort;
      }

      // LAN mode: disable ICE to avoid STUN interference
      const peerOptions = {
        ...this.getPeerOptions(),
        debug: 0,
        config: { iceServers: [] },
      };
      console.log('[LAN-CLIENT] Creating Peer with config:', this.serverConfig, 'options:', peerOptions);

      // Use undefined to let server auto-assign ID (fixes Android compatibility)
      this.peer = new Peer(undefined as any, peerOptions);

      let connected = false;
      const markConnected = () => { if (!connected) { connected = true; } };
      const markFailed = () => { if (!connected) { connected = true; resolve(false); } };

      this.peer.on('open', (id) => {
        this._myId = id;
        console.log(`[LAN-CLIENT] My ID: ${this._myId}, server connected at ${this.serverConfig.host}:${this._serverPort}, sending JOIN to host ${hostId}`);
        // Send JOIN via signaling server (for host awareness)
        this.peer!.socket!.send({ type: 'JOIN', src: this._myId, payload: { name: myName } });
        console.log('[LAN-CLIENT] JOIN sent');
        // Establish P2P data connection to host
        const conn = this.peer!.connect(hostId, {
          reliable: true,
          metadata: { name: myName },
        });
        conn.on('open', () => {
          this.hostConn = conn;
          console.log('[LAN-CLIENT] Connected to host!');
          // Notify app that the host is now connected (so App can show host player in list)
          this.emit('peer-connected', { id: hostId, name: 'Host' });
        });
        conn.on('error', (err: any) => {
          console.error('[LAN-CLIENT] P2P connection error:', err);
          this.emit('connection-error', {});
          markFailed();
        });
        this.peer!.on('close', () => markFailed());
        this.connected = true;
        this.emit('connection-ready', { role: 'client' });
        resolve(true);
      });

      this.peer.on('error', (err: any) => {
        console.error('[LAN-CLIENT] Peer error:', err.type, err.message, err);
        this.emit('connection-error', {});
        markFailed();
      });
    });
  }

  private handleGuestConnection(conn: DataConnection): void {
    const peerId = conn.peer;
    this.guestConns.set(peerId, conn);

    conn.on('open', () => {
      console.log(`[LAN-HOST] Guest connected: ${peerId}`);
      this.emit('peer-connected', { id: peerId, name: conn.metadata?.name || peerId });
      // Send current player list to the newly connected guest
      const playerList = Array.from(this.guestConns.entries()).map(([id, c]) => ({
        id,
        name: c.metadata?.name || id,
      }));
      conn.send({ type: 'player-list', players: playerList });
    });

    conn.on('data', (data: any) => {
      this.handleGuestMessage(data, peerId);
    });

    conn.on('close', () => {
      this.guestConns.delete(peerId);
      this.emit('peer-disconnected', { id: peerId });
    });
  }

  private handleGuestMessage(data: any, peerId: string): void {
    console.log('[LAN-HOST] handleGuestMessage received:', data.type, 'from:', peerId, 'payload:', JSON.stringify(data.payload || data).slice(0, 200));
    if (data.type === 'join') {
      console.log(`[LAN-HOST] Guest "${data.payload?.name}" joined`);
    } else if (data.type === 'play-card' || data.type === 'pass-card') {
      this.emit('data-received', { from: peerId, payload: data.payload || data });
    }
  }

  private setupHostChannel(conn: DataConnection): void {
    console.log('[LAN-CLIENT] setupHostChannel bound, conn.open:', conn.open);
    conn.on('open', () => {
      console.log('[LAN-CLIENT] hostConn opened');
    });
    conn.on('data', (data: any) => {
      console.log('[LAN-CLIENT] <<< RAW DATA FROM HOST >>>', JSON.stringify(data).slice(0, 200));
      // Route based on message type
      if (data.type === 'player-list') {
        this.emit('data-received', { from: 'host', payload: { type: 'player-list', players: data.players } });
      } else if (data.type === 'game-state') {
        // Direct game state broadcast from host
        console.log('[LAN-CLIENT] game-state payload phase:', data.payload?.phase);
        this.emit('data-received', { from: 'host', payload: data.payload });
      } else if (data.type === 'play-card' || data.type === 'pass-card') {
        this.emit('data-received', { from: 'host', payload: data.payload || data });
      }
    });

    conn.on('close', () => {
      console.log('[LAN-CLIENT] Host connection closed');
      this.connected = false;
      this.emit('connection-error', {});
    });
  }

  // handleHostMessage kept for backward compatibility with direct conn.on('data') in tests
  private handleHostMessage(data: any): void {
    console.log('[LAN-CLIENT] handleHostMessage received:', data.type, 'keys:', Object.keys(data || {}));
    if (data.type === 'player-list') {
      this.emit('data-received', { from: 'host', payload: { type: 'player-list', players: data.players } });
    } else if (data.type === 'game-state' || data.type === 'play-card' || data.type === 'pass-card') {
      this.emit('data-received', { from: 'host', payload: data.payload || data });
    }
  }

  sendToHost(type: string, payload: any): boolean {
    if (this._role !== 'client' || !this.hostConn) return false;
    try {
      this.hostConn.send({ type, from: this._myId, payload });
      return true;
    } catch {
      return false;
    }
  }

  broadcast(payload: any): void {
    if (this._role !== 'host') return;
    console.log('[LAN-HOST] broadcast called, guestConns size:', this.guestConns.size);

    // Serialize Map/Set to plain objects for PeerJS JSON transport
    const serialized: any = {};
    for (const [key, value] of Object.entries(payload || {})) {
      if (value instanceof Map) {
        serialized[key] = Object.fromEntries(value);
      } else if (value instanceof Set) {
        serialized[key] = Array.from(value);
      } else {
        serialized[key] = value;
      }
    }

    const msg = { type: 'game-state', from: this._myId, payload: serialized };

    // Send to all guests (send object, PeerJS handles JSON serialization)
    let sent = 0;
    for (const [id, conn] of this.guestConns) {
      try {
        console.log('[LAN-HOST] Sending to guest:', id, 'conn.open:', conn.open);
        conn.send(msg);
        sent++;
      } catch (e) {
        console.error('[LAN-HOST] Failed to send to guest:', id, e);
      }
    }
    console.log('[LAN-HOST] Sent to', sent, 'guests');

    // Self-emit (host keeps original with Maps for local use)
    // Do NOT emit to data-received callback which would run deserializeLanState on a Map-containing payload.
    // Host should retain its own gameState directly.
  }

  broadcastPlayerList(players: { id: string; name: string }[]): void {
    if (this._role !== 'host') return;
    for (const [, conn] of this.guestConns) {
      try {
        conn.send({ type: 'player-list', players });
      } catch {}
    }
  }

  disconnect(): void {
    if (this.hostConn) {
      try { this.hostConn.close(); } catch {}
      this.hostConn = null;
    }
    for (const [, conn] of this.guestConns) {
      try { conn.close(); } catch {}
    }
    this.guestConns.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.connected = false;
    this._role = null;
    this._myId = '';
    this._roomId = '';
    this._lanClientPasses = {};
    // Clear saved port on disconnect
    try { localStorage.removeItem('heart-lan-server-port'); } catch {}
  }

  on(event: LanEvent, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: LanEvent, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  /**
   * Get the singleton instance (for use in components that don't have access to the export)
   */
  static getInstance(): LanPeerManager {
    return lanPeer;
  }
}

export const lanPeer = new LanPeerManager();
// Detect Android environment immediately (navigator/window available at module load)
lanPeer.detectAndroid();
