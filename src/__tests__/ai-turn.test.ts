import { describe, it, expect } from 'vitest';
import { createInitialState, startRound } from '../game/hearts-game';
import { getAiPlayDecision } from '../game/ai-turn';
import type { Player } from '../game/types';

function makeHumanPlayer(id: string, name: string): Player {
  return { id, name, score: 0, isHuman: true, isAi: false };
}

function makeAiPlayer(id: string, name: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): Player {
  return { id, name, score: 0, isHuman: false, isAi: true, difficulty };
}

describe('getAiPlayDecision', () => {
  it('returns null when phase is not playing', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const result = getAiPlayDecision(state);
    expect(result).toBeNull();
  });

  it('returns null when phase is passing', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    // startRound goes through dealCardsForRound which sets phase='passing' then applyCardPass -> 'playing'
    // But round 1 passes left, so phase should be 'playing' after startRound
    // Let's test with a manually crafted passing state
    const passingState = { ...round, phase: 'passing' as const };
    const result = getAiPlayDecision(passingState);
    expect(result).toBeNull();
  });

  it('returns null when current player is human', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    // If human is the current player (2 of clubs holder), should return null
    const humanState = { ...round, currentPlayerId: 'p0' };
    const result = getAiPlayDecision(humanState);
    expect(result).toBeNull();
  });

  it('returns decision when current player is AI', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    // Force AI to be current player
    const aiState = { ...round, currentPlayerId: 'p1' };
    const result = getAiPlayDecision(aiState);
    expect(result).not.toBeNull();
    expect(result!.playerId).toBe('p1');
    expect(typeof result!.cardId).toBe('string');
    expect(result!.delay).toBeGreaterThan(0);
  });

  it('returns null when AI has no cards', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    // Clear AI's hand
    const emptyHandState = {
      ...round,
      currentPlayerId: 'p1',
      hands: new Map(round.hands),
    };
    emptyHandState.hands.set('p1', []);
    const result = getAiPlayDecision(emptyHandState);
    expect(result).toBeNull();
  });

  it('respects trickJustCompleted flag', () => {
    const players = [
      makeHumanPlayer('p0', 'Human'),
      makeAiPlayer('p1', 'AI 1'),
      makeHumanPlayer('p2', 'Human2'),
      makeHumanPlayer('p3', 'Human3'),
    ];
    const state = createInitialState(players);
    const round = startRound(state);
    const completedTrickState = {
      ...round,
      currentPlayerId: 'p1',
      trickJustCompleted: true,
    };
    const result = getAiPlayDecision(completedTrickState);
    expect(result).toBeNull();
  });
});
