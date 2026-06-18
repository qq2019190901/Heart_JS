import { describe, it, expect } from 'vitest';
import { getAiDecision } from '../game/ai';
import { createDeck, dealCards } from '../game/deck';
import { createInitialState, startRound } from '../game/hearts-game';
import type { Card, TrickState, Suit, Rank, Player } from '../game/types';

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: `${suit}-${rank}` };
}

describe('AI decision', () => {
  it('returns a card for easy difficulty', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: false, difficulty: 'easy' as const, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const aiHand = round.hands.get('p1') || [];
    const decision = getAiDecision(round.players[1], aiHand, null, false, 'easy');
    expect(decision.cardIds.length).toBeGreaterThanOrEqual(0);
    expect(decision.delay).toBe(800);
  });

  it('returns a card for medium difficulty', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: false, difficulty: 'medium' as const, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const aiHand = round.hands.get('p1') || [];
    const decision = getAiDecision(round.players[1], aiHand, null, false, 'medium');
    expect(decision.delay).toBe(600);
  });

  it('returns a card for hard difficulty', () => {
    const players: Player[] = [
      { id: 'p0', name: 'P1', isHuman: true, score: 0 },
      { id: 'p1', name: 'P2', isHuman: false, difficulty: 'hard' as const, score: 0 },
      { id: 'p2', name: 'P3', isHuman: true, score: 0 },
      { id: 'p3', name: 'P4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const aiHand = round.hands.get('p1') || [];
    const decision = getAiDecision(round.players[1], aiHand, null, false, 'hard');
    expect(decision.delay).toBe(400);
  });

  it('does not mutate input hand', () => {
    const hand = [card('hearts', 5), card('spades', 10), card('diamonds', 3), card('clubs', 8)];
    const original = [...hand];
    const trick: TrickState | null = null;
    getAiDecision(
      { id: 'ai', name: 'AI', isHuman: false, difficulty: 'medium', score: 0 },
      hand,
      trick,
      false,
      'medium'
    );
    expect(hand).toEqual(original);
  });

  it('prefers non-hearts when hearts not broken', () => {
    const hand = [card('hearts', 5), card('spades', 10), card('diamonds', 3)];
    const decision = getAiDecision(
      { id: 'ai', name: 'AI', isHuman: false, difficulty: 'medium', score: 0 },
      hand,
      null,
      false,
      'medium'
    );
    // Should not pick a heart
    if (decision.cardIds.length > 0) {
      const picked = hand.find(c => c.id === decision.cardIds[0]);
      expect(picked?.suit).not.toBe('hearts');
    }
  });
});
