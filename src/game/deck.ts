import type { Card, Suit, Rank } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RANK_NAMES: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${suit}-${rank}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[], playerIds: string[]): Map<string, Card[]> {
  const hands = new Map<string, Card[]>();
  const shuffled = shuffleDeck(deck);
  for (const id of playerIds) {
    hands.set(id, []);
  }
  for (let i = 0; i < shuffled.length; i++) {
    const playerId = playerIds[i % playerIds.length];
    hands.get(playerId)!.push(shuffled[i]);
  }
  // Sort each hand by suit then rank
  for (const [id, cards] of hands) {
    cards.sort((a, b) => {
      const suitOrder = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
      if (suitOrder !== 0) return suitOrder;
      return a.rank - b.rank;
    });
  }
  return hands;
}

export function cardToString(card: Card): string {
  const rankStr = RANK_NAMES[card.rank] ?? String(card.rank);
  const color = card.suit === 'hearts' || card.suit === 'diamonds' ? '#e74c3c' : '#2c3e50';
  return `${rankStr}${color}`;
}

export function getCardSymbol(card: Card): string {
  return `${RANK_NAMES[card.rank] ?? card.rank}${SUIT_SYMBOLS[card.suit]}`;
}
