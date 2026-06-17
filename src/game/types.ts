// ===== Core Types =====

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  isAi?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  score: number;
  isHuman: boolean;
}

export type GamePhase =
  | 'menu'
  | 'dealing'
  | 'passing'
  | 'playing'
  | 'trickComplete'
  | 'roundOver'
  | 'gameOver';

export type TrickState = {
  cards: { card: Card; playerId: string }[];
  leaderId: string;
  trickNumber: number;
};

export interface GameState {
  players: Player[];
  deck: Card[];
  hands: Map<string, Card[]>;
  currentTrick: TrickState | null;
  phase: GamePhase;
  currentPlayerId: string;
  leadSuit: Suit | null;
  passedDirections: Record<string, 'left' | 'right' | 'none'>;
  passedCards: Record<string, Card[]>;
  scores: Record<string, number>;
  roundNumber: number;
  queenOfSpadesPlayed: boolean;
  highestHeart: Card | null;
  trickCardsWon: Record<string, Card[]>; // Track cards each player won this round for SGR detection
  trickJustCompleted: boolean; // True for one tick after trick completes, to show all 4 cards
}

export type PassDirection = 'left' | 'right' | 'none';

// ===== Multiplayer Protocol =====

export const ServerToClientMsg = {
  GAME_STATE: 'game_state',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  WAIT_TURN: 'wait_turn',
  ROUND_OVER: 'round_over',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  ROOM_FULL: 'room_full',
  START_GAME: 'start_game',
} as const;

export const ClientToServerMsg = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAY_CARD: 'play_card',
  PASS_CARD: 'pass_card',
  READY: 'ready',
  CREATE_ROOM: 'create_room',
} as const;

export interface PlayCardPayload {
  cardId: string;
}

export interface JoinRoomPayload {
  playerName: string;
  roomId?: string;
}

// ===== AI Types =====

export interface AiDecision {
  cardIds: string[];
  delay: number; // ms
}
