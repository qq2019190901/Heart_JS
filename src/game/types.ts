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
  passedDirections: Record<string, 'left' | 'right' | 'across' | 'none'>;
  passedCards: Record<string, Card[]>;
  scores: Record<string, number>;
  roundNumber: number;
  queenOfSpadesPlayed: boolean;
  highestHeart: Card | null;
  trickCardsWon: Record<string, Card[]>; // Track cards each player won this round for SGR detection
  trickJustCompleted: boolean; // True for one tick after trick completes, to show all 4 cards
}

export type PassDirection = 'left' | 'right' | 'across' | 'none';

// ===== AI Types =====

export interface AiDecision {
  cardIds: string[];
  delay: number; // ms
}
