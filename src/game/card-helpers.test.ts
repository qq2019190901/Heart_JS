import { describe, it, expect } from 'vitest';
import {
  createDeck,
  cardId,
  cardPoints,
  countPoints,
  isTwoOfClubs,
  isQueenOfSpades,
  TWO_OF_CLUBS,
  QUEEN_OF_SPADES,
} from './deck';
import type { Card } from './types';

function makeCard(suit: string, rank: number): Card {
  return { suit: suit as Card['suit'], rank: rank as Card['rank'], id: cardId(suit as Card['suit'], rank as Card['rank']) };
}

describe('cardId', () => {
  it('produces the canonical suit-rank id used across the app', () => {
    expect(cardId('spades', 12)).toBe('spades-12');
    expect(cardId('hearts', 2)).toBe('hearts-2');
  });

  it('matches the ids assigned by createDeck', () => {
    const deck = createDeck();
    for (const card of deck) {
      expect(card.id).toBe(cardId(card.suit, card.rank));
    }
  });

  it('generates unique ids for all 52 cards', () => {
    const ids = createDeck().map(c => c.id);
    expect(new Set(ids).size).toBe(52);
  });
});

describe('isTwoOfClubs / isQueenOfSpades', () => {
  it('identifies the two of clubs', () => {
    expect(isTwoOfClubs(makeCard('clubs', 2))).toBe(true);
    expect(isTwoOfClubs(makeCard('clubs', 3))).toBe(false);
    expect(isTwoOfClubs(makeCard('diamonds', 2))).toBe(false);
  });

  it('identifies the queen of spades', () => {
    expect(isQueenOfSpades(makeCard('spades', 12))).toBe(true);
    expect(isQueenOfSpades(makeCard('spades', 11))).toBe(false);
    expect(isQueenOfSpades(makeCard('hearts', 12))).toBe(false);
  });

  it('exposes stable constants for the special cards', () => {
    expect(TWO_OF_CLUBS).toEqual({ suit: 'clubs', rank: 2 });
    expect(QUEEN_OF_SPADES).toEqual({ suit: 'spades', rank: 12 });
  });
});

describe('cardPoints / countPoints', () => {
  it('scores every heart as 1 point', () => {
    for (let rank = 2; rank <= 14; rank++) {
      expect(cardPoints(makeCard('hearts', rank))).toBe(1);
    }
  });

  it('scores the queen of spades as 13 points', () => {
    expect(cardPoints(makeCard('spades', 12))).toBe(13);
  });

  it('scores all other cards as 0', () => {
    expect(cardPoints(makeCard('spades', 14))).toBe(0);
    expect(cardPoints(makeCard('clubs', 2))).toBe(0);
    expect(cardPoints(makeCard('diamonds', 10))).toBe(0);
  });

  it('totals a full round to exactly 26 points', () => {
    const deck = createDeck();
    expect(countPoints(deck)).toBe(26);
  });

  it('returns 0 for an empty collection', () => {
    expect(countPoints([])).toBe(0);
  });

  it('sums mixed scoring and non-scoring cards', () => {
    const cards = [
      makeCard('hearts', 5),
      makeCard('hearts', 6),
      makeCard('spades', 12),
      makeCard('clubs', 9),
    ];
    expect(countPoints(cards)).toBe(15);
  });
});
