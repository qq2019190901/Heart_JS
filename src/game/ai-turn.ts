import type { GameState, Card, Player } from './types';
import { getAiDecision } from './ai';
import { heartsAreBroken } from './rules';

/**
 * Compute AI decision for the current player.
 * Returns null if not an AI turn or no playable cards.
 */
export function getAiPlayDecision(
  state: GameState,
): { playerId: string; cardId: string; delay: number } | null {
  if (state.phase !== 'playing' || state.trickJustCompleted) return null;

  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId);
  if (!currentPlayer || !currentPlayer.isAi) return null;

  const hand = state.hands.get(currentPlayer.id) || [];
  if (hand.length === 0) return null;

  const difficulty = (currentPlayer as any).difficulty || 'medium';
  const hb = heartsAreBroken(state.hands, state.highestHeart);
  const aiCtx = {
    scores: state.scores,
    roundNumber: state.roundNumber,
    trickCardsWon: state.trickCardsWon,
    queenOfSpadesPlayed: state.queenOfSpadesPlayed,
    highestHeart: state.highestHeart,
  };
  const decision = getAiDecision(currentPlayer, hand, state.currentTrick, hb, difficulty as 'easy' | 'medium' | 'hard', aiCtx);

  if (decision.cardIds.length === 0) return null;

  return {
    playerId: currentPlayer.id,
    cardId: decision.cardIds[0],
    delay: decision.delay,
  };
}
