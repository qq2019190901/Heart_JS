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
      path: '/',  // PeerJS appends 'peerjs' automatically, so '/' gives '/peerjs'
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
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this._myId = id;
        this._roomId = id;
        this.connected = true;
        const note = desiredId && id !== desiredId
          ? ` (requested ${desiredId}, got ${id})`
          : '';
        console.log(`[LAN-HOST] Room ID: ${id}${note} (server: ${opts.host}:${opts.port})`);
        this.emit('connection-ready', { roomId: id, role: 'host' });
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
  async initAsClient(myName: string, hostId: string): Promise<boolean> {
    // Auto-detect Android local IP before proceeding (same as initAsHost)
    await this.resolveServerConfig().catch(() => {});

    return new Promise((resolve) => {
      this._role = 'client';
      this._roomId = hostId;

      // Clean up old peer before creating a new one
      if (this.peer) {
        try { this.peer.destroy(); } catch {}
        this.peer = null;
      }

      // Auto-detect server: URL hash > Android native port > localStorage > default
      // Note: if user already set serverConfig via setServerConfig(), respect it
      const urlServer = LanPeerManager.getServerFromUrl();
      const savedServer = LanPeerManager.getSavedServer();
      console.log('[LAN-CLIENT] initAsClient: isElectron=', !!(window as any).electronAPI, 'urlServer=', urlServer, 'savedServer=', savedServer, 'currentConfig=', this.serverConfig, 'android=', this._isAndroid);
      if (urlServer) {
        this.serverConfig = urlServer;
      } else if (this._isAndroid) {
        // Use the actual port from the native side (may be fallback port if 9000 is taken)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        const nativePort = win.__serverPort ?? (win.AndroidBridge ? win.AndroidBridge.getServerPort() : -1);
        if (nativePort > 0) {
          this.serverConfig = { ...this.serverConfig, port: nativePort };
          this._serverPort = nativePort;
        }
        // If host is still localhost, use the resolved Android IP
        if (this.serverConfig.host === 'localhost' || this.serverConfig.host === '127.0.0.1') {
          this.serverConfig = { ...this.serverConfig, host: this._androidLocalIp || 'localhost' };
        }
      } else if (savedServer && savedServer.host !== '127.0.0.1' && savedServer.host !== 'localhost') {
        this.serverConfig = savedServer;
      } else if (this._serverMode === 'custom' && !this.serverConfig.host) {
        // custom mode but no config set, use default
      }
      this.peer = new Peer(undefined as any, {
        ...this.getPeerOptions(),
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      let connected = false;
      const markConnected = () => { if (!connected) { connected = true; } };
      const markFailed = () => { if (!connected) { connected = true; resolve(false); } };

      this.peer.on('open', () => {
        this._myId = this.peer!.id;
        console.log(`[LAN-CLIENT] My ID: ${this._myId}, connecting to host ${hostId}`);
        // Connect immediately after own Peer is registered with server
        const conn = this.peer!.connect(hostId, {
          reliable: true,
          metadata: { name: myName },
        });

        conn.on('open', () => {
          this.hostConn = conn;
          this.connected = true;
          this.setupHostChannel(conn);
          console.log('[LAN-CLIENT] Connected to host!');
          this.emit('connection-ready', { role: 'client' });
          resolve(true);
        });

        conn.on('error', (err: any) => {
          console.error('[LAN-CLIENT] Connection error:', err);
          this.emit('connection-error', {});
          resolve(false);
        });

        this.peer!.on('close', () => markFailed());
      });

      this.peer.on('error', (err: any) => {
        console.error('[LAN-CLIENT] Peer error:', err);
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
