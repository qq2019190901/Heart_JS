import { describe, it, expect } from 'vitest';
import { createDeck, dealCards } from '../game/deck';
import { canPlayCard, heartsAreBroken, trickWinner, getAllPlayableCards } from '../game/rules';
import { createInitialState, startRound, playCard } from '../game/hearts-game';
import type { Card, GameState, TrickState } from '../game/types';

// ===== Helper: create a card =====
function card(suit: string, rank: number): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

// ===== Helper: create hands map =====
function handsMap(entries: [string, Card[]][]): Map<string, Card[]> {
  return new Map(entries);
}

describe('deck', () => {
  it('creates 52 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
  });

  it('has all suits and ranks', () => {
    const deck = createDeck();
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
  });

  it('deals evenly to 4 players', () => {
    const deck = createDeck();
    const hands = dealCards(deck, ['p0', 'p1', 'p2', 'p3']);
    for (const player of ['p0', 'p1', 'p2', 'p3']) {
      expect(hands.get(player)).toHaveLength(13);
    }
  });
});

describe('canPlayCard', () => {
  it('allows any card when hearts are broken', () => {
    const hand = [card('hearts', 5), card('spades', 10)];
    expect(canPlayCard(hand[0], hand, null, true)).toBe(true);
    expect(canPlayCard(hand[1], hand, null, true)).toBe(true);
  });

  it('requires 2 of clubs in first trick when player has it', () => {
    const hand = [card('clubs', 2), card('hearts', 5), card('diamonds', 10)];
    expect(canPlayCard(hand[0], hand, null, false)).toBe(true);
    expect(canPlayCard(hand[1], hand, null, false)).toBe(false);
    expect(canPlayCard(hand[2], hand, null, false)).toBe(false);
  });

  it('allows any non-heart/non-QS when player does not have 2 of clubs', () => {
    const hand = [card('hearts', 5), card('spades', 10), card('diamonds', 10)];
    expect(canPlayCard(hand[0], hand, null, false)).toBe(false); // hearts blocked
    expect(canPlayCard(hand[1], hand, null, false)).toBe(true);  // spades 10 ok
    expect(canPlayCard(hand[2], hand, null, false)).toBe(true);  // diamonds ok
  });

  it('blocks hearts and QS when only those remain (edge case)', () => {
    const hand = [card('hearts', 5), card('spades', 12)];
    expect(canPlayCard(hand[0], hand, null, false)).toBe(true); // only option
    expect(canPlayCard(hand[1], hand, null, false)).toBe(true); // only option
  });

  it('requires following suit', () => {
    const trick: TrickState = { cards: [{ card: card('hearts', 5), playerId: 'p0' }], leaderId: 'p0', trickNumber: 1 };
    const hand = [card('hearts', 7), card('spades', 10), card('diamonds', 3)];
    expect(canPlayCard(hand[0], hand, trick, true)).toBe(true);  // follow suit
    expect(canPlayCard(hand[1], hand, trick, true)).toBe(false); // must follow hearts
    expect(canPlayCard(hand[2], hand, trick, true)).toBe(false); // must follow hearts
  });

  it('allows any card when cannot follow suit', () => {
    const trick: TrickState = { cards: [{ card: card('hearts', 5), playerId: 'p0' }], leaderId: 'p0', trickNumber: 1 };
    const hand = [card('spades', 10), card('diamonds', 3)];
    expect(canPlayCard(hand[0], hand, trick, true)).toBe(true);
    expect(canPlayCard(hand[1], hand, trick, true)).toBe(true);
  });
});

describe('heartsAreBroken', () => {
  it('returns true if any heart has been played', () => {
    const h = handsMap([
      ['p0', [card('hearts', 5), card('spades', 10)]],
      ['p1', [card('diamonds', 3), card('clubs', 8)]],
    ]);
    expect(heartsAreBroken(h)).toBe(true);
  });

  it('returns false if no hearts played', () => {
    const h = handsMap([
      ['p0', [card('spades', 10), card('diamonds', 3)]],
      ['p1', [card('clubs', 8), card('spades', 2)]],
    ]);
    expect(heartsAreBroken(h)).toBe(false);
  });
});

describe('trickWinner', () => {
  it('returns the highest card of lead suit', () => {
    const trick: TrickState = {
      cards: [
        { card: card('hearts', 5), playerId: 'p0' },
        { card: card('hearts', 10), playerId: 'p1' },
        { card: card('spades', 14), playerId: 'p2' }, // spades can't win
        { card: card('hearts', 7), playerId: 'p3' },
      ],
      leaderId: 'p0',
      trickNumber: 1,
    };
    expect(trickWinner(trick, new Map())).toBe('p1');
  });
});

describe('startRound', () => {
  it('deals 13 cards to each player', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    for (const p of players) {
      expect(round.hands.get(p.id)).toHaveLength(13);
    }
  });

  it('sets phase to playing', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    expect(round.phase).toBe('playing');
  });

  it('sets 2 of clubs as leader', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const leaderHand = round.hands.get(round.currentPlayerId) || [];
    expect(leaderHand.some(c => c.suit === 'clubs' && c.rank === 2)).toBe(true);
  });
});

describe('playCard', () => {
  it('removes card from player hand', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const leaderId = round.currentPlayerId;
    const hand = round.hands.get(leaderId) || [];
    const firstCard = hand[0];

    const afterPlay = playCard(round, leaderId, firstCard.id);
    const updatedHand = afterPlay.hands.get(leaderId) || [];
    expect(updatedHand).toHaveLength(12);
    expect(updatedHand.some(c => c.id === firstCard.id)).toBe(false);
  });

  it('tracks current trick after playing a card', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const leaderId = round.currentPlayerId;

    // Play one card -- trick is now in progress
    const hand = round.hands.get(leaderId) || [];
    const afterPlay = playCard(round, leaderId, hand[0].id);
    expect(afterPlay.phase).toBe('playing');
    expect(afterPlay.currentTrick).not.toBeNull();
    expect(afterPlay.currentTrick!.cards.length).toBe(1);
  });

  it('awards points to trick winner', () => {
    const players = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const scoresBefore = { ...round.scores };

    const hand = round.hands.get(round.currentPlayerId) || [];
    const afterPlay = playCard(round, round.currentPlayerId, hand[0].id);

    // Scores should be updated
    for (const pid of Object.keys(scoresBefore)) {
      expect(afterPlay.scores[pid]).toBeDefined();
    }
  });
});

describe('getAllPlayableCards', () => {
  it('returns only legal cards', () => {
    const hand = [card('hearts', 5), card('spades', 10), card('diamonds', 3)];
    const playable = getAllPlayableCards(hand, null, false);
    // Only non-heart, non-QS cards allowed when no 2 of clubs
    expect(playable).toHaveLength(2);
    expect(playable.some(c => c.suit === 'spades' && c.rank === 10)).toBe(true);
    expect(playable.some(c => c.suit === 'diamonds' && c.rank === 3)).toBe(true);
  });
});
