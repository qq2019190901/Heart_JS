import Peer, { type DataConnection } from 'peerjs';
import type { Card } from '../game/types';

export type LanRole = 'host' | 'client';

export type LanEvent =
  | 'connection-ready'
  | 'peer-connected'
  | 'peer-disconnected'
  | 'data-received'
  | 'connection-error';

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
  _lanClientPasses: Record<string, Card[]> = {};

  get isConnected() { return this.connected; }
  get role() { return this._role; }
  get myId() { return this._myId; }
  get roomId() { return this._roomId; }
  get hostConnection() { return this.hostConn; }
  get guestConnections() { return new Map(this.guestConns); }

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
  }

  /**
   * Build PeerJS options from server config.
   */
  private getPeerOptions(): { host: string; port: number; path: string } {
    return {
      host: this.serverConfig.host,
      port: this.serverConfig.port,
      path: '/peerjs',
    };
  }

  /**
   * Host: connect to self-hosted PeerJS server.
   * @param myName Display name for this player
   * @param desiredId Optional custom ID to use as room code.
   *                  If unavailable, server auto-assigns one.
   * @returns The actual room ID (may differ from desiredId if taken)
   */
  initAsHost(myName: string, desiredId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this._role = 'host';
      const opts = this.getPeerOptions();
      // If desiredId provided, try to use it; otherwise let server auto-assign
      const peerId = desiredId || undefined;
      this.peer = new Peer(peerId as any, {
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
  initAsClient(myName: string, hostId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this._role = 'client';
      this._roomId = hostId;
      this.peer = new Peer(undefined as any, {
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
    this._role = 'client';
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
}

export const lanPeer = new LanPeerManager();
