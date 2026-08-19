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

    // Handle HTTP requests
    server.on('request', (req, res) => {
      const url = req.url || '';
      console.log(`[PeerServer] HTTP request: ${req.method} ${url}`);
      // PeerJS client asks for ID via GET /peerjs/id
      if (url.startsWith(path + '/id')) {
        const id = `peer-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        console.log(`[PeerServer] Sending ID: ${id}`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(id);
      } else if (url.startsWith(path + '/key')) {
        // Return API key
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(KEY);
      } else if (url.startsWith(path)) {
        // Other paths - return server info for discovery
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ name: 'PeerJS Server', version: '1.0.0' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    // Setup WebSocket server
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      // Parse: /peerjs?key=peerjs&id=xxx&token=xxx&version=1.5.5
      const keyIndex = url.indexOf('key=');
      if (!url.startsWith(path) || keyIndex === -1) return;

      const requestedKey = url.substring(keyIndex + 4).split('&')[0];
      if (requestedKey !== KEY) {
        socket.destroy();
        return;
      }

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

  stop(): void {
    this.wss.close();
    this.peers.clear();
    this.queues.clear();
  }
}

export { SimplePeerServer };
