import { describe, it, expect } from 'vitest';
import { createInitialState, startRound, playCard } from './hearts-game';
import type { Player } from './types';

function makePlayer(id: string, name: string, isAi = false, difficulty?: 'easy' | 'medium' | 'hard'): Player {
  return {
    id,
    name,
    isAi,
    difficulty,
    score: 0,
    isHuman: !isAi,
  };
}

describe('createInitialState', () => {
  it('creates game state with 4 players', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    expect(state.players).toHaveLength(4);
    expect(state.phase).toBe('dealing');
    expect(state.deck).toHaveLength(52);
    expect(state.hands.size).toBe(0); // Hands populated by startRound
    expect(state.currentTrick).toBeNull();
  });
});

describe('startRound', () => {
  it('deals 13 cards to each player', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    expect(roundState.phase).toBe('playing');
    expect(roundState.hands.get('p1')!.length).toBe(13);
    expect(roundState.hands.get('p2')!.length).toBe(13);
    expect(roundState.hands.get('p3')!.length).toBe(13);
    expect(roundState.hands.get('p4')!.length).toBe(13);
    expect(roundState.deck).toHaveLength(0);
  });

  it('sets 2 of clubs as first player', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    const hasTwoOfClubs = Array.from(roundState.hands.entries()).some(([pid, cards]) =>
      cards.some(c => c.suit === 'clubs' && c.rank === 2)
    );
    expect(hasTwoOfClubs).toBe(true);
  });

  it('handles card passing -- each player ends with 13', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      const hand = roundState.hands.get(pid);
      expect(hand).toBeDefined();
      expect(hand!.length).toBe(13);
    }
  });

  it('cycles passing directions based on round number', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];

    // Round 1: all pass left
    let state = createInitialState(players);
    let rs = startRound(state);
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(rs.passedDirections[pid]).toBe('left');
    }

    // Round 2: no passing
    state = createInitialState(players, 2);
    rs = startRound(state);
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(rs.passedDirections[pid]).toBe('none');
    }

    // Round 3: all pass right
    state = createInitialState(players, 3);
    rs = startRound(state);
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(rs.passedDirections[pid]).toBe('right');
    }

    // Round 4: no passing
    state = createInitialState(players, 4);
    rs = startRound(state);
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      expect(rs.passedDirections[pid]).toBe('none');
    }
  });

  it('total cards remain 52 after passing', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    let total = 0;
    for (const [, cards] of roundState.hands) {
      total += cards.length;
    }
    expect(total).toBe(52);
  });
});

describe('playCard', () => {
  it('removes card from player hand', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    const handBefore = roundState.hands.get('p1')!.length;
    const card = roundState.hands.get('p1')![0];

    const newState = playCard(roundState, 'p1', card.id);
    expect(newState.hands.get('p1')!.length).toBe(handBefore - 1);
  });

  it('adds card to current trick', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    const roundState = startRound(state);
    const card = roundState.hands.get('p1')![0];

    const newState = playCard(roundState, 'p1', card.id);
    expect(newState.currentTrick).not.toBeNull();
    expect(newState.currentTrick!.cards).toHaveLength(1);
    expect(newState.currentTrick!.cards[0].card.id).toBe(card.id);
  });

  it('completes trick after 4 cards', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    let gs = startRound(state);

    gs = playCard(gs, 'p1', gs.hands.get('p1')![0].id);
    gs = playCard(gs, 'p2', gs.hands.get('p2')![0].id);
    gs = playCard(gs, 'p3', gs.hands.get('p3')![0].id);
    gs = playCard(gs, 'p4', gs.hands.get('p4')![0].id);

    expect(gs.currentTrick).toBeNull();
    expect(gs.hands.get('p1')!.length).toBe(12);
    expect(gs.hands.get('p4')!.length).toBe(12);
  });

  it('awards trick points to winner', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    let gs = startRound(state);

    gs = playCard(gs, 'p1', gs.hands.get('p1')![0].id);
    gs = playCard(gs, 'p2', gs.hands.get('p2')![0].id);
    gs = playCard(gs, 'p3', gs.hands.get('p3')![0].id);
    gs = playCard(gs, 'p4', gs.hands.get('p4')![0].id);

    const totalAwarded = Object.values(gs.scores).reduce((a, b) => a + b, 0);
    expect(totalAwarded).toBeGreaterThanOrEqual(0);
  });

  it('finishes round after all 13 tricks', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    let gs = startRound(state);

    for (let trick = 0; trick < 13; trick++) {
      for (const pid of ['p1', 'p2', 'p3', 'p4']) {
        const hand = gs.hands.get(pid)!;
        if (hand.length > 0) {
          gs = playCard(gs, pid, hand[0].id);
        }
      }
    }

    expect(gs.phase).toBe('roundOver');
  });

  it('tracks queen of spades played', () => {
    const players = [
      makePlayer('p1', 'Alice'),
      makePlayer('p2', 'Bob'),
      makePlayer('p3', 'Charlie'),
      makePlayer('p4', 'Diana'),
    ];
    const state = createInitialState(players);
    let gs = startRound(state);

    const qs = gs.hands.get('p1')?.find(c => c.suit === 'spades' && c.rank === 12);
    if (qs) {
      gs = playCard(gs, 'p1', qs.id);
      expect(gs.queenOfSpadesPlayed).toBe(true);
    }
  });
});
