import { describe, it, expect } from 'vitest';
import { createDeck, dealCards } from '../game/deck';
import { createInitialState, startRound, playCard } from '../game/hearts-game';
import { heartsAreBroken, canPlayCard } from '../game/rules';
import { isShotGunTheRose } from '../game/rules';
import type { Card, Player } from '../game/types';

function card(suit: string, rank: number): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

describe('GameState serialization', () => {
  it('serializes Map hands to plain object', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: false, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);

    const handsPlain: Record<string, Card[]> = {};
    for (const [k, v] of round.hands) handsPlain[k] = v;
    const serialized = { ...round, hands: handsPlain };

    expect(serialized.hands).toHaveProperty('p0');
    expect(serialized.hands.p0).toHaveLength(13);
  });

  it('deserializes plain object back to Map', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: false, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);

    const handsPlain: Record<string, Card[]> = {};
    for (const [k, v] of round.hands) handsPlain[k] = v;
    const serialized = { ...round, hands: handsPlain };

    const hands = new Map<string, Card[]>();
    if (serialized.hands && typeof serialized.hands === 'object') {
      for (const [k, v] of Object.entries(serialized.hands)) {
        if (Array.isArray(v)) hands.set(k, v);
      }
    }
    const deserialized = { ...serialized, hands } as typeof round;

    expect(deserialized.hands.get('p0')).toHaveLength(13);
    expect(deserialized.hands.get('p1')).toHaveLength(13);
  });
});

describe('Shot Gun The Rose', () => {
  it('detects SGR when one player has all hearts + QS', () => {
    const cardsByPlayer: Record<string, Card[]> = {
      p0: [
        card('hearts', 2), card('hearts', 3), card('hearts', 4), card('hearts', 5),
        card('hearts', 6), card('hearts', 7), card('hearts', 8), card('hearts', 9),
        card('hearts', 10), card('hearts', 11), card('hearts', 12), card('hearts', 13),
        card('hearts', 14), card('spades', 12),
      ],
      p1: [card('spades', 2), card('spades', 3)],
      p2: [card('diamonds', 2), card('diamonds', 3)],
      p3: [card('clubs', 2), card('clubs', 3)],
    };
    const sgr = isShotGunTheRose(cardsByPlayer);
    expect(sgr.found).toBe(true);
    expect(sgr.holderId).toBe('p0');
  });

  it('does not detect SGR when hearts distributed', () => {
    const cardsByPlayer: Record<string, Card[]> = {
      p0: [card('hearts', 2), card('hearts', 3)],
      p1: [card('hearts', 4), card('hearts', 5)],
      p2: [card('hearts', 6), card('hearts', 7)],
      p3: [card('spades', 12)],
    };
    const sgr = isShotGunTheRose(cardsByPlayer);
    expect(sgr.found).toBe(false);
  });

  it('works with Map input', () => {
    const hands = new Map<string, Card[]>();
    const allCards: Card[] = [];
    for (let r = 2; r <= 14; r++) allCards.push(card('hearts', r));
    allCards.push(card('spades', 12));
    hands.set('p0', allCards);
    hands.set('p1', [card('spades', 2)]);
    hands.set('p2', [card('diamonds', 2)]);
    hands.set('p3', [card('clubs', 2)]);

    const sgr = isShotGunTheRose(hands);
    expect(sgr.found).toBe(true);
    expect(sgr.holderId).toBe('p0');
  });
});

describe('Full round simulation', () => {
  function getAllPlayableCards(hand: Card[], trick: { cards: { card: Card; playerId: string }[] | null } | null, heartsBroken: boolean): Card[] {
    const leadSuit = trick?.cards?.[0]?.card.suit ?? null;
    if (!trick) {
      if (heartsBroken) return hand;
      const hasTwoOfClubs = hand.some(c => c.suit === 'clubs' && c.rank === 2);
      if (hasTwoOfClubs) return hand.filter(c => c.suit === 'clubs' && c.rank === 2);
      return hand.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12));
    }
    if (leadSuit && hand.some(c => c.suit === leadSuit)) return hand.filter(c => c.suit === leadSuit);
    return hand;
  }

  it('completes a full round', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: true, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    let round = startRound(state);

    // Play all cards trick by trick
    let maxIterations = 200;
    while (round.phase === 'playing' && maxIterations-- > 0) {
      const hand = round.hands.get(round.currentPlayerId) || [];
      if (hand.length === 0) {
        // Current player has no cards, advance to next
        const idx = players.findIndex(p => p.id === round.currentPlayerId);
        round.currentPlayerId = players[(idx + 1) % players.length].id;
        continue;
      }

      const playable = getAllPlayableCards(hand, round.currentTrick, heartsAreBroken(round.hands));
      if (playable.length === 0) {
        // No valid card, advance
        const idx = players.findIndex(p => p.id === round.currentPlayerId);
        round.currentPlayerId = players[(idx + 1) % players.length].id;
        continue;
      }

      round = playCard(round, round.currentPlayerId, playable[0].id);
    }

    expect(round.phase).toBe('roundOver');
    for (const player of players) {
      expect(round.hands.get(player.id)).toHaveLength(0);
    }
  });
});
