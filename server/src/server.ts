import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { ServerToClientMsg, ClientToServerMsg, DEFAULT_CONFIG, type RoomConfig, PASS_DIRECTION_CYCLE } from './protocol';
import type { Card, Player, GameState } from '../../src/game/types';
import { createDeck, dealCards } from '../../src/game/deck';
import { heartsAreBroken, canPlayCard } from '../../src/game/rules';
import { getAiDecision } from '../../src/game/ai';

const PORT = 3001;
const ROOM_CODE_LENGTH = 6;

// Serialize GameState: Map<string, Card[]> -> plain object for JSON
function serializeGameState(state: GameState): any {
  const handsPlain: Record<string, Card[]> = {};
  for (const [k, v] of state.hands) handsPlain[k] = v;
  return {
    ...state,
    hands: handsPlain,
    deck: state.deck,
  };
}

interface Room {
  id: string;
  players: ServerPlayer[];
  gameState: GameState | null;
  config: RoomConfig;
}

interface ServerPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  isAi: boolean;
  ready: boolean;
}

class GameServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private playerWsMap: Map<string, WebSocket> = new Map();
  private playerRoom: Map<string, string> = new Map();

  constructor() {
    this.wss = new WebSocketServer({ port: PORT });
    this.setupHandlers();
    console.log(`Hearts server running on ws://localhost:${PORT}`);
  }

  private setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, _req: IncomingMessage) {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch (_err) {
        console.error('Invalid message:', data);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  private handleMessage(ws: WebSocket, msg: any) {
    const playerId = this.getPlayerIdFromWs(ws);

    switch (msg.type) {
      case ClientToServerMsg.CREATE_ROOM:
        this.handleCreateRoom(ws, msg.playerName || 'Player');
        break;
      case ClientToServerMsg.JOIN_ROOM:
        this.handleJoinRoom(ws, msg.roomId, msg.playerName || 'Player');
        break;
      case ClientToServerMsg.LEAVE_ROOM:
        if (playerId) this.handleLeaveRoom(playerId);
        break;
      case ClientToServerMsg.PLAY_CARD:
        if (playerId) this.handlePlayCard(playerId, msg.cardId);
        break;
      case ClientToServerMsg.PASS_CARD:
        if (playerId) this.handlePassCard(playerId, msg.cardIds);
        break;
      case ClientToServerMsg.READY_UP:
        if (playerId) this.handleReadyUp(playerId);
        break
    }
  }

  private handleCreateRoom(ws: WebSocket, playerName: string) {
    const roomId = this.generateRoomCode();
    const room: Room = {
      id: roomId,
      players: [],
      gameState: null,
      config: { ...DEFAULT_CONFIG },
    };
    this.rooms.set(roomId, room);

    const player = this.addPlayer(ws, roomId, playerName);
    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.ROOM_CREATED,
      roomId,
      players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    });
  }

  private handleJoinRoom(ws: WebSocket, roomId: string, playerName: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: ServerToClientMsg.ERROR, message: 'Room not found' }));
      return;
    }
    if (room.players.length >= room.config.maxPlayers) {
      ws.send(JSON.stringify({ type: ServerToClientMsg.ROOM_FULL }));
      return;
    }

    this.addPlayer(ws, roomId, playerName);
    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.PLAYER_JOINED,
      player: { id: this.getPlayerIdFromWs(ws)!, name: playerName },
      players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    });
  }

  private handleDisconnect(ws: WebSocket) {
    const playerId = this.getPlayerIdFromWs(ws);
    if (playerId) this.handleLeaveRoom(playerId);
  }

  private handleLeaveRoom(playerId: string) {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) return;

    const playerIdx = room.players.findIndex(p => p.id === playerId);
    if (playerIdx !== -1) {
      const player = room.players[playerIdx];
      try { player.ws.close(); } catch {}
      room.players.splice(playerIdx, 1);
    }

    this.playerRoom.delete(playerId);
    this.playerWsMap.delete(playerId);
    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.PLAYER_LEFT,
      playerId,
      players: room.players.map(p => ({ id: p.id, name: p.name })),
    });

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  private handlePlayCard(playerId: string, cardId: string) {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return;

    const gs = room.gameState;
    if (gs.phase !== 'playing') return;

    const hand = gs.hands.get(playerId);
    if (!hand) return;
    const card = hand.find(c => c.id === cardId);
    if (!card) {
      this.broadcastError(roomId, 'Card not in hand');
      return;
    }

    // Validate card play against rules
    const hb = heartsAreBroken(gs.hands);
    if (!canPlayCard(card, hand, gs.currentTrick, hb)) {
      this.broadcastError(roomId, 'Invalid card play');
      return;
    }

    room.gameState = this.playCardInState(room.gameState, playerId, cardId);
    if (!room.gameState) return;

    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.GAME_STATE,
      state: serializeGameState(room.gameState),
    });

    if (room.gameState.phase === 'roundOver') {
      this.broadcastToRoom(roomId, { type: ServerToClientMsg.ROUND_OVER });
    } else if (room.gameState.phase === 'gameOver') {
      this.broadcastToRoom(roomId, { type: ServerToClientMsg.GAME_OVER });
    }

    this.processAiTurns(room);
  }

  private handlePassCard(playerId: string, cardIds: string[]) {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return;

    const gs = room.gameState;
    if (gs.phase !== 'passing') return;

    const hand = gs.hands.get(playerId);
    if (!hand) return;

    // Validate: player must submit exactly 3 cards (or fewer if they have < 4 cards)
    const submitted = cardIds.map(id => hand.find(c => c.id === id)).filter(Boolean) as Card[];
    const expectedCount = Math.min(3, Math.floor(hand.length / 4));
    if (submitted.length !== expectedCount) {
      this.broadcastError(roomId, `Please select exactly ${expectedCount} card(s) to pass.`);
      return;
    }

    // Check direction for this round
    const passCycle = PASS_DIRECTION_CYCLE;
    const passDir = passCycle[(gs.roundNumber - 1) % 4];
    gs.passedDirections[playerId] = passDir as 'left' | 'right' | 'none';

    // Store the actual card objects for processing and UI
    (gs as any)._playerPassCards = { ...(gs as any)._playerPassCards || {}, [playerId]: submitted };

    // Broadcast updated state to show what's been passed so far
    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.GAME_STATE,
      state: serializeGameState(gs),
    });

    // If human player just submitted and AI haven't started passing, trigger AI auto-pass
    const humanSubmitted = gs.players.some(p => p.isHuman && (gs as any)._playerPassCards?.[p.id]);
    const aiHavePassed = gs.players.filter(p => p.isAi).some(p => (gs as any)._playerPassCards?.[p.id]);

    if (humanSubmitted && !aiHavePassed) {
      // Start AI auto-pass after human submits
      setTimeout(() => this.autoPassAiCards(room), 500);
    } else if (humanSubmitted) {
      // AI already passed, check if all done
      this.checkAllPassed(room);
    }
  }

  private checkAllPassed(room: Room) {
    const gs = room.gameState;
    if (!gs) return;

    const playerPassCards = (gs as any)._playerPassCards as Record<string, Card[]> || {};
    const allPassed = gs.players.every(p => {
      const expected = Math.min(3, Math.floor((gs.hands.get(p.id) || []).length / 4));
      return (playerPassCards[p.id] || []).length === expected;
    });

    if (allPassed) {
      this.applyCardPass(room);
    }
  }

  private applyCardPass(room: Room) {
    const gs = room.gameState;
    if (!gs) return;

    const passDir = PASS_DIRECTION_CYCLE[(gs.roundNumber - 1) % 4];
    const playerPassCards = (gs as any)._playerPassCards as Record<string, Card[]> | undefined;

    if (passDir !== 'none') {
      for (let i = 0; i < gs.players.length; i++) {
        const pid = gs.players[i].id;
        const hand = gs.hands.get(pid) || [];
        const toPass = playerPassCards?.[pid] || [];
        let updatedHand = hand.filter(c => !toPass.some(pc => pc.id === c.id));

        let receiveFrom: number;
        if (passDir === 'left') {
          receiveFrom = (i - 1 + gs.players.length) % gs.players.length;
        } else if (passDir === 'right') {
          receiveFrom = (i + 1) % gs.players.length;
        } else if (passDir === 'across') {
          receiveFrom = (i - 2 + gs.players.length) % gs.players.length;
        } else {
          receiveFrom = i;
        }
        const received = playerPassCards?.[gs.players[receiveFrom].id] || [];
        updatedHand = [...updatedHand, ...received];
        updatedHand.sort(sortHand);
        gs.hands.set(pid, updatedHand);
      }
    }

    // Build passedCards record for client UI
    gs.passedCards = {};
    for (const [pid, cards] of Object.entries(playerPassCards || {})) {
      gs.passedCards[pid] = cards;
    }

    // Clear temp data
    delete (gs as any)._playerPassCards;

    gs.phase = 'playing';

    let leaderId: string | null = null;
    for (const [pid, cards] of gs.hands) {
      if (cards.some(c => c.suit === 'clubs' && c.rank === 2)) {
        leaderId = pid;
        break;
      }
    }
    gs.currentPlayerId = leaderId ?? gs.players[0].id;
    gs.leadSuit = null;
    gs.currentTrick = null;

    room.gameState = gs;

    this.broadcastToRoom(room.id, {
      type: ServerToClientMsg.GAME_STATE,
      state: serializeGameState(gs),
    });

    this.processAiTurns(room);
  }

  private handleReadyUp(playerId: string) {
    const roomId = this.playerRoom.get(playerId);
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room || room.gameState) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    player.ready = true;

    // Broadcast updated player list with ready status
    this.broadcastToRoom(roomId, {
      type: ServerToClientMsg.PLAYER_JOINED,
      player: { id: player.id, name: player.name, ready: true },
      players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })),
    });

    // Check if all players are ready and room is full (or config says use AI)
    const allReady = room.players.every(p => p.ready);
    const isFullOrFilled = room.players.length >= 4 || room.config.useAi && room.players.length + room.config.aiCount >= 4;

    if (allReady && isFullOrFilled) {
      // Fill with AI if needed
      while (room.players.length < 4 && room.config.useAi) {
        const aiNames = ['AI 左', 'AI 上', 'AI 右'];
        const aiCount = room.players.filter(p => p.isAi).length;
        if (aiCount < 3) {
          const aiPlayer: ServerPlayer = {
            id: `ai-${Date.now()}-${aiCount}`,
            name: aiNames[aiCount] || `AI ${aiCount + 1}`,
            ws: null as any,
            isAi: true,
            ready: true,
          };
          room.players.push(aiPlayer);
        } else {
          break;
        }
      }

      this.startGame(room);
    }
  }

  private handleReady(_playerId: string) {}

  private playCardInState(state: GameState, playerId: string, cardId: string): GameState | null {
    const hand = state.hands.get(playerId);
    if (!hand) return state;

    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return state;

    const card = hand[cardIndex];
    const newHand = [...hand];
    newHand.splice(cardIndex, 1);

    const newState = { ...state };
    newState.hands = new Map(state.hands);
    newState.hands.set(playerId, newHand);

    let trick = newState.currentTrick;
    if (!trick) {
      trick = { cards: [{ card, playerId }], leaderId: playerId, trickNumber: (state.roundNumber - 1) * 13 + 1 };
      newState.leadSuit = card.suit;
    } else {
      trick = { ...trick, cards: [...trick.cards, { card, playerId }] };
    }
    newState.currentTrick = trick;

    if (card.suit === 'spades' && card.rank === 12) {
      newState.queenOfSpadesPlayed = true;
    }

    if (trick.cards.length === newState.players.length) {
      const leadSuit = trick.cards[0].card.suit;
      let winningIndex = 0;
      for (let i = 1; i < trick.cards.length; i++) {
        if (trick.cards[i].card.suit === leadSuit) {
          if (trick.cards[i].card.rank > trick.cards[winningIndex].card.rank) {
            winningIndex = i;
          }
        }
      }
      const winnerId = trick.cards[winningIndex].playerId;

      let trickPoints = 0;
      for (const play of trick.cards) {
        if (play.card.suit === 'hearts') trickPoints += 1;
        if (play.card.suit === 'spades' && play.card.rank === 12) trickPoints += 13;
      }
      newState.scores = { ...newState.scores };
      newState.scores[winnerId] = (newState.scores[winnerId] || 0) + trickPoints;

      newState.currentTrick = null;

      const allEmpty = Array.from(newState.hands.values()).every(h => h.length === 0);
      if (allEmpty) {
        return this.finishRound(newState);
      }

      newState.currentPlayerId = winnerId;
      newState.leadSuit = null;
    } else {
      // Trick not complete: advance to next player
      const currentPlayerIdx = newState.players.findIndex(p => p.id === playerId);
      const nextPlayerIdx = (currentPlayerIdx + 1) % newState.players.length;
      newState.currentPlayerId = newState.players[nextPlayerIdx].id;
    }

    return newState;
  }

  private finishRound(state: GameState): GameState {
    const scores = { ...state.scores };
    let gameOver = false;
    for (const [, score] of Object.entries(scores)) {
      if (score >= 100) { gameOver = true; break; }
    }
    return { ...state, scores, phase: gameOver ? 'gameOver' as const : 'roundOver' as const };
  }

  private startGame(room: Room) {
    const players: Player[] = room.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isAi: p.isAi,
      difficulty: (room.config.useAi ? room.config.aiDifficulty : undefined) as 'easy' | 'medium' | 'hard' | undefined,
      score: room.gameState?.scores[p.id] ?? 0,
      isHuman: !p.isAi,
    }));

    const gameState: GameState = {
      players,
      deck: createDeck(),
      hands: new Map(),
      currentTrick: null,
      phase: 'dealing',
      currentPlayerId: '',
      leadSuit: null,
      passedDirections: {},
      passedCards: {},
      scores: {},
      roundNumber: room.gameState?.roundNumber ?? 1,
      queenOfSpadesPlayed: false,
      highestHeart: null,
      trickCardsWon: {},
    };

    const playerIds = players.map(p => p.id);
    const hands = dealCards(gameState.deck, playerIds);
    gameState.hands = hands;
    gameState.deck = [];
    gameState.phase = 'passing';
    gameState.passedDirections = {};
    gameState.passedCards = {};

    room.gameState = gameState;
    this.broadcastToRoom(room.id, {
      type: ServerToClientMsg.START_GAME,
      state: serializeGameState(gameState),
    });

    // Auto-pass for AI players
    this.autoPassAiCards(room);
  }

  private autoPassAiCards(room: Room) {
    const gs = room.gameState;
    if (!gs || gs.phase !== 'passing') return;

    const passCycle = PASS_DIRECTION_CYCLE;
    const passDir = passCycle[(gs.roundNumber - 1) % 4];

    if (passDir === 'none') {
      // No passing this round, go straight to playing
      this.applyCardPass(room);
      return;
    }

    // Find AI players who haven't passed yet
    const playerPassCards = (gs as any)._playerPassCards as Record<string, Card[]> || {};
    const aiPlayers = gs.players.filter(p => p.isAi && !playerPassCards[p.id]);

    if (aiPlayers.length === 0) {
      // All AI players have passed, check if all players done
      this.checkAllPassed(room);
      return;
    }

    // Process one AI player at a time (for staggered timing)
    const ai = aiPlayers[0];
    const hand = gs.hands.get(ai.id) || [];
    const cardsToPass = this.serverPassCards(hand, passDir);

    playerPassCards[ai.id] = cardsToPass;
    gs.passedDirections[ai.id] = passDir as 'left' | 'right' | 'none';

    // Broadcast to show AI has passed
    this.broadcastToRoom(room.id, {
      type: ServerToClientMsg.GAME_STATE,
      state: serializeGameState(gs),
    });

    // After a delay, process next AI
    setTimeout(() => {
      this.autoPassAiCards(room);
    }, 300);
  }

  private serverPassCards(hand: Card[], direction: 'left' | 'right' | 'across'): Card[] {
    const cardsToPass: Card[] = [];
    const count = Math.min(3, Math.floor(hand.length / 4));

    if (direction === 'right') {
      const suitCounts = new Map<string, number>();
      for (const c of hand) suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
      const sortedSuits = Array.from(suitCounts.entries()).sort((a, b) => b[1] - a[1]);
      for (const [suit] of sortedSuits) {
        const suitCards = hand.filter(c => c.suit === suit).sort((a, b) => b.rank - a.rank);
        const toTake = Math.min(count - cardsToPass.length, suitCards.length);
        cardsToPass.push(...suitCards.slice(0, toTake));
        if (cardsToPass.length >= count) break;
      }
    } else {
      const suitCards = [...hand]
        .filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12))
        .sort((a, b) => b.rank - a.rank);
      cardsToPass.push(...suitCards.slice(0, count));
    }
    return cardsToPass;
  }

  private addPlayer(ws: WebSocket, roomId: string, name: string): ServerPlayer {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player: ServerPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      ws,
      isAi: false,
      ready: false,
    };
    room.players.push(player);
    this.playerRoom.set(player.id, roomId);
    this.playerWsMap.set(player.id, ws);
    return player;
  }

  private getPlayerIdFromWs(ws: WebSocket): string | null {
    for (const [pid, w] of this.playerWsMap) {
      if (w === ws) return pid;
    }
    return null;
  }

  private broadcastToRoom(roomId: string, data: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const player of room.players) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(data));
      }
    }
  }

  private broadcastError(roomId: string, message: string) {
    this.broadcastToRoom(roomId, { type: ServerToClientMsg.ERROR, message });
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private processAiTurns(room: Room) {
    if (!room.gameState) return;

    const processNext = () => {
      if (!room.gameState) return;

      const gs = room.gameState;
      if (gs.phase !== 'playing') return;

      const currentPlayer = gs.players.find(p => p.id === gs.currentPlayerId);
      if (!currentPlayer) return;

      if (currentPlayer.isHuman) return;

      const hand = gs.hands.get(currentPlayer.id) || [];
      if (hand.length === 0) return;

      const hb = heartsAreBroken(gs.hands);
      const difficulty = (currentPlayer as unknown as Record<string, unknown>).difficulty as 'easy' | 'medium' | 'hard' | undefined;

      const decision = getAiDecision(
        currentPlayer,
        hand,
        gs.currentTrick,
        hb,
        difficulty || 'medium'
      );

      if (decision.cardIds.length === 0) return;

      room.gameState = this.playCardInState(room.gameState!, currentPlayer.id, decision.cardIds[0]);
      if (!room.gameState) return;

      this.broadcastToRoom(room.id, {
        type: ServerToClientMsg.GAME_STATE,
        state: serializeGameState(room.gameState),
      });

      if (room.gameState.phase === 'roundOver') {
        this.broadcastToRoom(room.id, { type: ServerToClientMsg.ROUND_OVER });
        return;
      } else if (room.gameState.phase === 'gameOver') {
        this.broadcastToRoom(room.id, { type: ServerToClientMsg.GAME_OVER });
        return;
      }

      const nextDelay = difficulty === 'easy' ? 800 : difficulty === 'medium' ? 600 : 400;
      setTimeout(processNext, nextDelay);
    };

    setTimeout(processNext, 500);
  }
}

new GameServer();

function getPassOffsetReverse(dir: 'left' | 'right', playerCount: number): number {
  if (dir === 'left') return playerCount - 1;
  if (dir === 'right') return 1;
  return 0;
}

function sortHand(a: Card, b: Card): number {
  const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
  const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  if (suitDiff !== 0) return suitDiff;
  return a.rank - b.rank;
}
