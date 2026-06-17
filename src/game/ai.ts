import type { Card, TrickState, AiDecision, Player, Suit } from './types';
import { canPlayCard, getAllPlayableCards, heartsAreBroken, trickWinner } from './rules';

export function getAiDecision(
  player: Player,
  hand: Card[],
  trick: TrickState | null,
  heartsBroken: boolean,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): AiDecision {
  const playable = getAllPlayableCards(hand, trick, heartsBroken);

  if (playable.length === 0) {
    return { cardIds: [], delay: 500 };
  }

  let chosen: Card;

  switch (difficulty) {
    case 'easy':
      chosen = easyPlay(playable, hand, trick, heartsBroken);
      break;
    case 'medium':
      chosen = mediumPlay(playable, hand, trick, heartsBroken);
      break;
    case 'hard':
      chosen = hardPlay(playable, hand, trick, heartsBroken);
      break;
    default:
      chosen = playable[Math.floor(Math.random() * playable.length)];
  }

  const cardIds = [chosen.id];
  // Delay based on difficulty for realism
  const delay = difficulty === 'easy' ? 800 : difficulty === 'medium' ? 600 : 400;

  return { cardIds, delay };
}

function easyPlay(playable: Card[], hand: Card[], trick: TrickState | null, _heartsBroken: boolean): Card {
  // Random valid card
  return playable[Math.floor(Math.random() * playable.length)];
}

function mediumPlay(playable: Card[], hand: Card[], trick: TrickState | null, heartsBroken: boolean): Card {
  // Avoid playing hearts/Q♠ if possible, follow suit
  const leadSuit = trick?.cards[0]?.card.suit ?? null;

  // If can follow suit, prefer non-heart, non-Q♠
  if (leadSuit && leadSuit !== 'hearts') {
    const followSuit = playable.filter(c => c.suit === leadSuit);
    if (followSuit.length > 0) {
      const safe = followSuit.filter(c => c.suit !== 'hearts');
      if (safe.length > 0) return safe[0];
      return followSuit[0];
    }
  }

  // Don't play hearts if not broken
  if (!heartsBroken) {
    const nonHearts = playable.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12));
    if (nonHearts.length > 0) return nonHearts[0];
  }

  // Otherwise play lowest card
  return [...playable].sort((a, b) => a.rank - b.rank)[0];
}

function hardPlay(playable: Card[], hand: Card[], trick: TrickState | null, heartsBroken: boolean): Card {
  const leadSuit = trick?.cards[0]?.card.suit ?? null;

  // Simulate trick outcome for each playable card
  let bestCard = playable[0];
  let bestScore = Infinity;

  for (const card of playable) {
    const score = simulateTrick(card, hand, trick, leadSuit, heartsBroken);
    if (score < bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  return bestCard;
}

function simulateTrick(
  card: Card,
  hand: Card[],
  trick: TrickState | null,
  leadSuit: Suit | null,
  heartsBroken: boolean
): number {
  let score = 0;

  // If leading (no cards played yet)
  if (!trick || trick.cards.length === 0) {
    if (card.suit === 'hearts' && !heartsBroken) score += 100; // Bad: leading with heart early
    if (card.suit === 'spades' && card.rank === 12) score += 50; // Bad: leading with Q♠
    score += card.rank; // Prefer lower cards when leading
    return score;
  }

  // If following suit
  if (card.suit === (leadSuit ?? '')) {
    // Calculate if we'd win the trick
    const ourCard = { card, playerId: 'me' };
    const allCards = [...trick.cards, ourCard];
    const tempTrick: TrickState = {
      cards: allCards,
      leaderId: trick.leaderId,
      trickNumber: trick.trickNumber,
    };
    const winner = trickWinner(tempTrick, new Map());

    if (winner === 'me') {
      // We win the trick - count points we'd take
      for (const c of allCards) {
        if (c.card.suit === 'hearts') score += 1;
        if (c.card.suit === 'spades' && c.card.rank === 12) score += 13;
      }
      return score; // Lower is better
    }
    // We lose - no penalty, just play a low card
    return card.rank;
  }

  // Can't follow suit - discard
  if (card.suit === 'hearts') score += 1;
  if (card.suit === 'spades' && card.rank === 12) score += 13;
  score += card.rank;
  return score;
}
