/**
 * Minimal PeerJS-compatible signaling server.
 * Implements only what the PeerJS client needs.
 */
import http from 'http';
import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';

const KEY = 'peerjs';

class SimplePeerServer extends EventEmitter {
  private wss: WebSocketServer;
  private peers = new Map<string, WebSocket>();
  private queues = new Map<string, string[]>();

  constructor(server: http.Server, options: { path: string }) {
    super();
    const path = options.path || '/peerjs';

    // Store actual listening port for client discovery
    let actualPort = 0;

    // Handle HTTP requests
    server.on('request', (req, res) => {
      const url = req.url || '';
      console.log(`[PeerServer] HTTP request: ${req.method} ${url}`);

      // CORS headers — Android WebView origin is http://localhost, requesting host is LAN IP
      const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };

      // Handle preflight OPTIONS request
      if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
      }

      // Allow client to discover the actual server port
      if (url === '/peerjs/port' || url === path + '/port') {
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ port: actualPort }));
        return;
      }

      // PeerJS client asks for ID via GET /peerjs/id  (path='/' → URL=/peerjs/id)
      // Also support legacy double-path for compatibility
      if (url.startsWith('/peerjs/id') || url.startsWith(path + '/peerjs/id')) {
        const id = `peer-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        console.log(`[PeerServer] Sending ID: ${id}`);
        res.writeHead(200, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end(id);
      } else if (url.startsWith('/peerjs/key') || url.startsWith(path + '/peerjs/key')) {
        // Return API key
        res.writeHead(200, { 'Content-Type': 'text/plain', ...corsHeaders });
        res.end(KEY);
      } else if (url.startsWith(path)) {
        // Other paths - return server info for discovery
        res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ name: 'PeerJS Server', version: '1.0.0' }));
      } else {
        res.writeHead(404, corsHeaders);
        res.end();
      }
    });

    // Setup WebSocket server
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      console.log(`[PeerServer] Upgrade request: ${url}`);
      // Parse: /peerjs?key=peerjs&id=xxx&token=xxx&version=1.5.5
      const keyIndex = url.indexOf('key=');
      // Accept /peerjs?key=... (path='/') or legacy /peerjs/peerjs?key=... (path='/peerjs')
      const isValidUpgrade = (url.startsWith('/peerjs') || url.startsWith(path + '/peerjs')) && keyIndex >= 0;
      if (!isValidUpgrade) {
        console.log('[PeerServer] Upgrade rejected: invalid path or missing key');
        socket.destroy();
        return;
      }

      const requestedKey = url.substring(keyIndex + 4).split('&')[0];
      console.log(`[PeerServer] Upgrade key check: requested="${requestedKey}", expected="${KEY}"`);
      if (requestedKey !== KEY) {
        console.log('[PeerServer] Upgrade rejected: invalid key');
        socket.destroy();
        return;
      }

      console.log('[PeerServer] Accepting WebSocket upgrade');
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (conn: WebSocket, req) => {
      const url = req.url || '';
      // Extract ID from query params: ?id=xxx
      const idMatch = url.match(/[?&]id=([^&]+)/);
      const peerId = idMatch?.[1] || `peer-${Date.now()}`;

      if (this.peers.has(peerId)) {
        conn.send(JSON.stringify({ type: 'ERROR', payload: { msg: 'ID already exists' } }));
        conn.close();
        return;
      }

      this.peers.set(peerId, conn);
      conn.send(JSON.stringify({ type: 'OPEN', id: peerId }));
      console.log(`[PeerServer] Peer registered: ${peerId}`);

      // Flush queued messages
      const queue = this.queues.get(peerId);
      if (queue) {
        this.queues.delete(peerId);
        for (const msg of queue) conn.send(msg);
      }

      conn.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(msg, peerId, conn);
        } catch (e) {
          console.error('[PeerServer] Message parse error:', e);
        }
      });

      conn.on('close', () => {
        this.peers.delete(peerId);
        this.queues.delete(peerId);
        console.log(`[PeerServer] Peer disconnected: ${peerId}`);
        // Notify all peers about disconnection
        for (const [id, peerConn] of this.peers) {
          peerConn.send(JSON.stringify({
            type: 'LEAVE',
            src: peerId,
            dst: id,
          }));
        }
      });

      this.emit('peerConnect', peerId);
    });
  }

  private handleMessage(msg: any, srcId: string, srcConn: WebSocket) {
    const type = msg.type;
    const dst = msg.dst;

    console.log(`[PeerServer] Message from ${srcId}: type=${type}, dst=${dst}`);

    switch (type) {
      case 'heartbeat':
        // No-op
        break;

      case 'offer':
      case 'answer':
      case 'candidate':
        // Forward WebRTC signaling messages
        if (dst) {
          this.forwardMessage(dst, srcId, msg);
        }
        break;

      case 'JOIN':
        // Broadcast JOIN to all other peers so the host learns about new clients
        for (const [id, peerConn] of this.peers) {
          if (id !== srcId && peerConn.readyState === WebSocket.OPEN) {
            peerConn.send(JSON.stringify(msg));
          }
        }
        break;

      case 'LEAVE':
        if (dst) {
          const target = this.peers.get(dst);
          if (target?.readyState === WebSocket.OPEN) {
            target.send(JSON.stringify({ type: 'LEAVE', src: srcId, dst }));
          }
        }
        this.peers.delete(srcId);
        this.queues.delete(srcId);
        srcConn.close();
        break;

      default:
        if (dst) {
          this.forwardMessage(dst, srcId, msg);
        }
    }
  }

  private forwardMessage(dstId: string, srcId: string, msg: any) {
    const target = this.peers.get(dstId);
    if (target?.readyState === WebSocket.OPEN) {
      const forwarded = { ...msg, src: srcId };
      target.send(JSON.stringify(forwarded));
      console.log(`[PeerServer] Forwarded ${msg.type} from ${srcId} to ${dstId}`);
    } else {
      console.log(`[PeerServer] Target ${dstId} offline, queuing ${msg.type}`);
      const q = this.queues.get(dstId) || [];
      q.push(JSON.stringify({ ...msg, src: srcId }));
      this.queues.set(dstId, q);
    }
  }

  /** Notify callback when server starts listening on a port */
  onListening(callback: (port: number) => void): void {
    // Hook into server's 'listening' event — caller must set this before start
  }

  setPort(port: number): void {
    // Called by main.ts after server starts listening
    console.log(`[PeerServer] Port set to ${port}`);
  }

  stop(): void {
    this.wss.close();
    this.peers.clear();
    this.queues.clear();
  }
}

export { SimplePeerServer };
