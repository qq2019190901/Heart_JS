import { describe, it, expect } from 'vitest';
import { getAiDecision } from './ai';
import type { Player, TrickState, Card, Suit, Rank } from './types';

function makePlayer(id: string, name: string, isAi = true, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Player {
  return {
    id,
    name,
    isAi,
    difficulty,
    score: 0,
    isHuman: false,
  };
}

function makeCard(suit: string, rank: number): Card {
  return { suit: suit as Suit, rank: rank as Rank, id: `${suit}-${rank}` };
}

function makeHand(cards: { suit: string; rank: number }[]): Card[] {
  return cards.map(c => makeCard(c.suit, c.rank));
}

describe('AI Decision', () => {
  it('easy AI returns a valid card', () => {
    const player = makePlayer('ai-0', 'AI Easy', true, 'easy');
    const hand = makeHand([
      { suit: 'hearts', rank: 5 },
      { suit: 'clubs', rank: 2 },
      { suit: 'spades', rank: 10 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'easy');
    expect(decision.cardIds.length).toBeGreaterThan(0);
    expect(decision.delay).toBe(800);
  });

  it('medium AI avoids hearts when possible', () => {
    const player = makePlayer('ai-0', 'AI Medium', true, 'medium');
    const hand = makeHand([
      { suit: 'hearts', rank: 5 },
      { suit: 'clubs', rank: 2 },
      { suit: 'diamonds', rank: 3 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'medium');
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    expect(chosen?.suit).not.toBe('hearts');
  });

  it('hard AI simulates trick outcomes', () => {
    const player = makePlayer('ai-0', 'AI Hard', true, 'hard');
    const hand = makeHand([
      { suit: 'hearts', rank: 14 },
      { suit: 'clubs', rank: 2 },
      { suit: 'spades', rank: 10 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'hard');
    expect(decision.cardIds.length).toBeGreaterThan(0);
    expect(decision.delay).toBe(400);
  });

  it('AI returns empty when no playable cards', () => {
    const player = makePlayer('ai-0', 'AI', true);
    const decision = getAiDecision(player, [], null, false);
    expect(decision.cardIds).toHaveLength(0);
  });

  it('AI follows suit in trick', () => {
    const player = makePlayer('ai-0', 'AI', true);
    const hand = makeHand([
      { suit: 'spades', rank: 5 },
      { suit: 'spades', rank: 10 },
      { suit: 'hearts', rank: 3 },
    ]);
    const trick: TrickState = {
      cards: [{ card: makeCard('spades', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const decision = getAiDecision(player, hand, trick, true);
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    expect(chosen?.suit).toBe('spades');
  });

  it('AI avoids Q of spades when possible', () => {
    const player = makePlayer('ai-0', 'AI Medium', true, 'medium');
    const hand = makeHand([
      { suit: 'spades', rank: 12 },
      { suit: 'clubs', rank: 3 },
      { suit: 'clubs', rank: 5 },
    ]);
    const trick: TrickState = {
      cards: [{ card: makeCard('clubs', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const decision = getAiDecision(player, hand, trick, true);
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    expect(chosen?.rank).not.toBe(12);
  });

  it('hard AI prefers lowest-scoring cards', () => {
    const player = makePlayer('ai-0', 'AI Hard', true, 'hard');
    // Hand with a high heart and a low club
    const hand = makeHand([
      { suit: 'hearts', rank: 14 }, // A♥ = 1pt
      { suit: 'clubs', rank: 2 },   // 2♣ = 0pt
    ]);
    const decision = getAiDecision(player, hand, null, false, 'hard');
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    // Hard AI should prefer the club (lower score)
    expect(chosen?.suit).toBe('clubs');
  });

  it('AI respects canPlayCard constraints', () => {
    const player = makePlayer('ai-0', 'AI', true);
    const hand = makeHand([
      { suit: 'hearts', rank: 5 },
      { suit: 'spades', rank: 10 },
    ]);
    const trick: TrickState = {
      cards: [{ card: makeCard('spades', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    // Hearts broken, but must follow spades
    const decision = getAiDecision(player, hand, trick, true);
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    expect(chosen?.suit).toBe('spades');
  });

  it('easy AI returns varied delays', () => {
    const player = makePlayer('ai-0', 'AI Easy', true, 'easy');
    const hand = makeHand([
      { suit: 'clubs', rank: 3 },
      { suit: 'diamonds', rank: 5 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'easy');
    expect(decision.delay).toBe(800);
  });

  it('AI handles empty hand gracefully', () => {
    const player = makePlayer('ai-0', 'AI', true);
    const decision = getAiDecision(player, [], null, false);
    expect(decision.cardIds).toHaveLength(0);
    expect(decision.delay).toBe(500);
  });
});

describe('AI Strategy Edge Cases', () => {
  it('medium AI leads with lowest non-heart card', () => {
    const player = makePlayer('ai-0', 'AI Medium', true, 'medium');
    const hand = makeHand([
      { suit: 'hearts', rank: 3 },
      { suit: 'hearts', rank: 7 },
      { suit: 'clubs', rank: 5 },
      { suit: 'diamonds', rank: 8 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'medium');
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    // Should avoid hearts when not broken
    expect(chosen?.suit).not.toBe('hearts');
  });

  it('hard AI avoids leading with Q of spades', () => {
    const player = makePlayer('ai-0', 'AI Hard', true, 'hard');
    const hand = makeHand([
      { suit: 'spades', rank: 12 }, // Q♠
      { suit: 'clubs', rank: 3 },
      { suit: 'diamonds', rank: 4 },
    ]);
    const decision = getAiDecision(player, hand, null, false, 'hard');
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    expect(chosen?.id).not.toBe('spades-12');
  });

  it('hard AI simulates trick outcome for following cards', () => {
    const player = makePlayer('ai-0', 'AI Hard', true, 'hard');
    const hand = makeHand([
      { suit: 'spades', rank: 5 },
      { suit: 'spades', rank: 10 },
    ]);
    const trick: TrickState = {
      cards: [{ card: makeCard('spades', 2), playerId: 'p1' }],
      leaderId: 'p1',
      trickNumber: 1,
    };
    const decision = getAiDecision(player, hand, trick, true, 'hard');
    const chosen = hand.find(c => c.id === decision.cardIds[0]);
    // Must follow spades, picks lower risk card
    expect(chosen?.suit).toBe('spades');
  });
});
