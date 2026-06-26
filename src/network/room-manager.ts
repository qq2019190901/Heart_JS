import type { Player } from '../game/types';

export type RoomStatus = 'idle' | 'waiting' | 'full' | 'starting' | 'playing';

export interface RoomInfo {
  roomId: string;
  hostId: string;
  hostName: string;
  status: RoomStatus;
  players: RoomPlayer[];
  maxPlayers: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isHuman: boolean;
  score: number;
  ready: boolean;
  isAi: boolean;
}

export class RoomManager {
  private room: RoomInfo | null = null;
  private localPlayerId: string = '';
  private _aiFallbackEnabled: boolean = true;

  get roomInfo() { return this.room; }
  get isHost() { return this.room?.hostId === this.localPlayerId; }
  get playerCount() { return this.room?.players.length ?? 0; }
  get aiFallbackEnabled() { return this._aiFallbackEnabled; }
  set aiFallbackEnabled(val: boolean) { this._aiFallbackEnabled = val; }

  initAsHost(playerId: string, playerName: string, roomId: string): void {
    this.localPlayerId = playerId;
    this.room = {
      roomId,
      hostId: playerId,
      hostName: playerName,
      status: 'waiting',
      players: [
        { id: playerId, name: playerName, isHuman: true, score: 0, ready: true, isAi: false },
      ],
      maxPlayers: 4,
    };
  }

  joinRoom(playerId: string, playerName: string): boolean {
    if (!this.room) return false;
    if (this.room.players.length >= 4) return false;
    if (this.room.status === 'playing') return false;

    this.localPlayerId = playerId;

    this.room.players.push({
      id: playerId,
      name: playerName,
      isHuman: true,
      score: 0,
      ready: true,
      isAi: false,
    });

    if (this.room.players.length >= 4) {
      this.room.status = 'starting';
    }

    return true;
  }

  addAiPlayer(): RoomPlayer | null {
    if (!this.room || this.room.players.length >= 4) return null;

    const positions = ['左', '上', '右'];
    const existingNames = this.room.players.map(p => p.name);
    let posIdx = 0;
    while (existingNames.includes(`AI ${positions[posIdx]}`)) {
      posIdx++;
    }

    const aiName = `AI ${positions[posIdx]}`;
    const aiId = `ai-${Date.now()}`;

    const aiPlayer: RoomPlayer = {
      id: aiId,
      name: aiName,
      isHuman: false,
      score: 0,
      ready: true,
      isAi: true,
    };

    this.room.players.push(aiPlayer);

    if (this.room.players.length >= 4) {
      this.room.status = 'starting';
    }

    return aiPlayer;
  }

  removePlayer(playerId: string): RoomPlayer | null {
    if (!this.room) return null;
    const idx = this.room.players.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    const removed = this.room.players.splice(idx, 1)[0];

    if (playerId === this.localPlayerId) {
      this.room = null;
      this.localPlayerId = '';
      return null;
    }

    if (removed.isAi && this._aiFallbackEnabled && this.room.players.length < 4) {
      return this.addAiPlayer();
    }

    return removed;
  }

  getPlayers(): Player[] {
    if (!this.room) return [];
    return this.room.players.map(p => ({
      id: p.id, name: p.name, score: p.score,
      isHuman: p.isHuman, isAi: p.isAi, difficulty: 'medium' as const,
    }));
  }

  toGameStatePlayers(): Player[] {
    return this.getPlayers();
  }

  canStart(): boolean {
    return (this.room?.players.length ?? 0) >= 2;
  }

  getHumanCount(): number {
    return this.room?.players.filter(p => p.isHuman).length ?? 0;
  }

  getAiCount(): number {
    return this.room?.players.filter(p => p.isAi).length ?? 0;
  }

  reset(): void {
    this.room = null;
    this.localPlayerId = '';
  }
}

export const roomManager = new RoomManager();
