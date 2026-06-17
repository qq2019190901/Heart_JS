import { GAME_PORT, WEBSOCKET_URL, ClientMsg, type ClientMessage } from './protocol';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connected = false;
  private playerName: string = '';
  private currentRoomId: string = '';

  connect(onConnect?: () => void) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WEBSOCKET_URL);

    this.ws.onopen = () => {
      this.connected = true;
      onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.emit(msg.type, msg);
      } catch {
        console.error('Failed to parse WS message:', event.data);
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.reconnect();
    };

    this.ws.onerror = (_err) => {
      console.error('WebSocket error');
    };
  }

  private reconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(() => {
        // Re-join room if we were in one
        if (this.currentRoomId && this.playerName) {
          this.joinRoom(this.playerName, this.currentRoomId);
        }
      });
    }, 3000);
  }

  setRoomId(roomId: string) {
    this.currentRoomId = roomId;
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  setPlayerName(name: string) {
    this.playerName = name;
  }

  createRoom(playerName: string) {
    this.playerName = playerName;
    this.send({ type: ClientMsg.CREATE_ROOM, playerName });
  }

  joinRoom(playerName: string, roomId: string) {
    this.playerName = playerName;
    this.send({ type: ClientMsg.JOIN_ROOM, playerName, roomId });
  }

  leaveRoom() {
    this.send({ type: ClientMsg.LEAVE_ROOM });
  }

  playCard(cardId: string) {
    this.send({ type: ClientMsg.PLAY_CARD, cardId });
  }

  passCard(cardIds: string[]) {
    this.send({ type: ClientMsg.PASS_CARD, cardIds });
  }

  ready() {
    this.send({ type: ClientMsg.READY });
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  disconnect() {
    this.reconnectTimer && clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

export const wsManager = new WebSocketManager();
