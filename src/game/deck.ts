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

/** Deal cards round-robin WITHOUT sorting — preserves original shuffled order. */
export function dealCardsRaw(deck: Card[], playerIds: string[]): Map<string, Card[]> {
  const hands = new Map<string, Card[]>();
  const shuffled = shuffleDeck(deck);
  for (const id of playerIds) {
    hands.set(id, []);
  }
  for (let i = 0; i < shuffled.length; i++) {
    const playerId = playerIds[i % playerIds.length];
    hands.get(playerId)!.push(shuffled[i]);
  }
  return hands;
}

/** Sort a single hand by suit order then rank ascending. */
export function sortHand(cards: Card[], suitOrder: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return a.rank - b.rank;
  });
}

/** Deal cards and sort each hand by suit then rank (legacy API). */
export function dealCards(deck: Card[], playerIds: string[]): Map<string, Card[]> {
  const hands = dealCardsRaw(deck, playerIds);
  for (const [id, cards] of hands) {
    hands.set(id, sortHand(cards));
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
