import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck } from './deck';
import { canPlayCard, heartsAreBroken, trickWinner, calculateRoundPoints, getAllPlayableCards, getLeadSuit, isShotGunTheRose } from './rules';
import type { Card, TrickState } from './types';

function makeCard(suit: string, rank: number): Card {
  return { suit: suit as any, rank: rank as any, id: `${suit}-${rank}` };
}

describe('Deck', () => {
  it('creates 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has all suits and ranks', () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    expect(suits).toContain('hearts');
    expect(suits).toContain('diamonds');
    expect(suits).toContain('clubs');
    expect(suits).toContain('spades');

    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
  });

  it('shuffles deck preserves all cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    expect(shuffled.map(c => c.id).sort()).toEqual(deck.map(c => c.id).sort());
  });
});

describe('canPlayCard', () => {
  it('allows any card when hearts are broken and first trick', () => {
    const hand = [makeCard('hearts', 5), makeCard('spades', 10)];
    expect(canPlayCard(hand[0], hand, null, true)).toBe(true);
    expect(canPlayCard(hand[1], hand, null, true)).toBe(true);
  });

  it('restricts first trick when hearts not broken', () => {
    const hand = [makeCard('hearts', 5), makeCard('spades', 12), makeCard('clubs', 2)];
    const hb = false;

    // Can play clubs (not hearts, not Qspades)
    expect(canPlayCard(hand[2], hand, null, hb)).toBe(true);
    // Cannot play hearts
    expect(canPlayCard(hand[0], hand, null, hb)).toBe(false);
    // Cannot play Q of spades
    expect(canPlayCard(hand[1], hand, null, hb)).toBe(false);
  });

  it('requires following suit during trick', () => {
    const hand = [makeCard('hearts', 5), makeCard('clubs', 3), makeCard('hearts', 8)];
    const trick: TrickState = {
      cards: [{ card: makeCard('hearts', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const hb = true;

    expect(canPlayCard(hand[0], hand, trick, hb)).toBe(true);
    expect(canPlayCard(hand[2], hand, trick, hb)).toBe(true);
    expect(canPlayCard(hand[1], hand, trick, hb)).toBe(false);
  });

  it('allows any card when cannot follow suit', () => {
    const hand = [makeCard('hearts', 5), makeCard('clubs', 3)];
    const trick: TrickState = {
      cards: [{ card: makeCard('spades', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const hb = true;

    expect(canPlayCard(hand[0], hand, trick, hb)).toBe(true);
    expect(canPlayCard(hand[1], hand, trick, hb)).toBe(true);
  });
});

describe('heartsAreBroken', () => {
  it('returns false when no hearts played', () => {
    const hands = new Map([
      ['p1', [makeCard('clubs', 2), makeCard('spades', 3)]],
      ['p2', [makeCard('diamonds', 5), makeCard('clubs', 7)]],
    ]);
    expect(heartsAreBroken(hands)).toBe(false);
  });

  it('returns true when any heart exists in hands', () => {
    const hands = new Map([
      ['p1', [makeCard('hearts', 5), makeCard('spades', 3)]],
      ['p2', [makeCard('diamonds', 5)]],
    ]);
    expect(heartsAreBroken(hands)).toBe(true);
  });
});

describe('trickWinner', () => {
  it('returns highest card of lead suit', () => {
    const trick: TrickState = {
      cards: [
        { card: makeCard('spades', 5), playerId: 'p1' },
        { card: makeCard('spades', 10), playerId: 'p2' },
        { card: makeCard('hearts', 3), playerId: 'p3' },
        { card: makeCard('spades', 8), playerId: 'p4' },
      ],
      leaderId: 'p1',
      trickNumber: 1,
    };
    expect(trickWinner(trick, new Map())).toBe('p2');
  });

  it('handles all same suit', () => {
    const trick: TrickState = {
      cards: [
        { card: makeCard('clubs', 2), playerId: 'p1' },
        { card: makeCard('clubs', 14), playerId: 'p2' },
        { card: makeCard('clubs', 3), playerId: 'p3' },
        { card: makeCard('clubs', 13), playerId: 'p4' },
      ],
      leaderId: 'p1',
      trickNumber: 1,
    };
    expect(trickWinner(trick, new Map())).toBe('p2');
  });
});

describe('calculateRoundPoints', () => {
  it('counts hearts and Q of spades', () => {
    const hands = new Map([
      ['p1', [makeCard('hearts', 5), makeCard('hearts', 8), makeCard('spades', 12)]],
      ['p2', [makeCard('clubs', 2), makeCard('diamonds', 3)]],
    ]);
    const points = calculateRoundPoints(hands);
    expect(points['p1']).toBe(15); // 2 hearts + 1 Qspades(13)
    expect(points['p2']).toBe(0);
  });
});

describe('getAllPlayableCards', () => {
  it('returns only valid cards', () => {
    const hand = [makeCard('hearts', 5), makeCard('clubs', 3), makeCard('diamonds', 7)];
    const trick: TrickState = {
      cards: [{ card: makeCard('clubs', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const playable = getAllPlayableCards(hand, trick, true);
    expect(playable).toHaveLength(1);
    expect(playable[0].suit).toBe('clubs');
  });
});

describe('getLeadSuit', () => {
  it('returns null for null trick', () => {
    expect(getLeadSuit(null)).toBeNull();
  });

  it('returns suit of first card', () => {
    const trick: TrickState = {
      cards: [{ card: makeCard('spades', 5), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    expect(getLeadSuit(trick)).toBe('spades');
  });
});

describe('isShotGunTheRose', () => {
  it('detects SGR with Map input', () => {
    const heartsCards = Array.from({ length: 13 }, (_, i) => makeCard('hearts', i + 2));
    const qsCard = makeCard('spades', 12);
    const hands = new Map([
      ['p1', [...heartsCards, qsCard]],
      ['p2', [makeCard('clubs', 2)]],
    ]);
    const result = isShotGunTheRose(hands);
    expect(result.found).toBe(true);
    expect(result.holderId).toBe('p1');
  });

  it('detects SGR with plain object input', () => {
    const heartsCards = Array.from({ length: 13 }, (_, i) => makeCard('hearts', i + 2));
    const qsCard = makeCard('spades', 12);
    const trickCardsWon: Record<string, Card[]> = {
      p1: [...heartsCards, qsCard],
      p2: [makeCard('clubs', 2)],
    };
    const result = isShotGunTheRose(trickCardsWon);
    expect(result.found).toBe(true);
    expect(result.holderId).toBe('p1');
  });

  it('returns false when cards are split', () => {
    const hands = new Map([
      ['p1', [makeCard('hearts', 5), makeCard('spades', 12)]],
      ['p2', [makeCard('hearts', 6)]],
    ]);
    const result = isShotGunTheRose(hands);
    expect(result.found).toBe(false);
  });
});
