import type { Card, TrickState, AiDecision, Player, Suit, AiContext } from './types';
import { canPlayCard, getAllPlayableCards, heartsAreBroken, trickWinner } from './rules';

export function getAiDecision(
  player: Player,
  hand: Card[],
  trick: TrickState | null,
  heartsBroken: boolean,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  ctx?: AiContext
): AiDecision {
  const playable = getAllPlayableCards(hand, trick, heartsBroken);

  if (playable.length === 0) {
    return { cardIds: [], delay: 500 };
  }

  let chosen: Card;
  const aiCtx = resolveDefault(ctx);

  switch (difficulty) {
    case 'easy':
      chosen = easyPlay(playable, hand, trick, heartsBroken);
      break;
    case 'medium':
      chosen = mediumPlay(playable, hand, trick, heartsBroken, aiCtx, player.id);
      break;
    case 'hard':
      chosen = hardPlay(playable, hand, trick, heartsBroken, aiCtx, player.id);
      break;
    default:
      chosen = playable[Math.floor(Math.random() * playable.length)];
  }

  const cardIds = [chosen.id];
  const delay = difficulty === 'easy' ? 800 : difficulty === 'medium' ? 600 : 400;
  return { cardIds, delay };
}

function resolveDefault(ctx?: AiContext): AiContext {
  return ctx || { scores: {}, roundNumber: 1, trickCardsWon: {}, queenOfSpadesPlayed: false, highestHeart: null };
}

// ========== Easy: Pure Random ==========

function easyPlay(playable: Card[], hand: Card[], trick: TrickState | null, _heartsBroken: boolean): Card {
  return playable[Math.floor(Math.random() * playable.length)];
}

// ========== Medium: Heuristic + Score Awareness ==========

function mediumPlay(
  playable: Card[], hand: Card[], trick: TrickState | null,
  heartsBroken: boolean, ctx: AiContext, playerId: string
): Card {
  const leadSuit = trick?.cards[0]?.card.suit ?? null;
  const scoreSit = evaluateScoreSituation(playerId, ctx.scores);

  // If can follow suit, prefer safe cards (not hearts)
  if (leadSuit && leadSuit !== 'hearts') {
    const followSuit = playable.filter(c => c.suit === leadSuit);
    if (followSuit.length > 0) {
      const safe = followSuit.filter(c => c.suit !== 'hearts');
      if (safe.length > 0) return safe[0];
      return followSuit[0];
    }
  }

  // Don't play hearts if not broken — more conservative when score is high
  if (!heartsBroken) {
    const nonHearts = playable.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12));
    if (nonHearts.length > 0) return nonHearts[0];
  }

  // Prefer dumping from suits with fewer remaining cards
  const suitCounts = countSuitRemaining(hand, trick, ctx.trickCardsWon);
  const sorted = [...playable].sort((a, b) => {
    const diff = (suitCounts.get(a.suit) || 0) - (suitCounts.get(b.suit) || 0);
    if (diff !== 0) return diff; // fewer remaining first
    return a.rank - b.rank; // then by rank
  });

  return sorted[0];
}

// ========== Hard: Full Strategic AI ==========

function hardPlay(
  playable: Card[], hand: Card[], trick: TrickState | null,
  heartsBroken: boolean, ctx: AiContext, playerId: string
): Card {
  const knownCards = buildKnownCards(hand, trick, ctx.trickCardsWon);
  const scoreSit = evaluateScoreSituation(playerId, ctx.scores);
  const sgrThreat = detectSgrThreat(ctx.trickCardsWon, playerId);
  const aggression = computeAggression(scoreSit, ctx.roundNumber);

  let bestCard = playable[0];
  let bestScore = Infinity;

  for (const card of playable) {
    // Base simulation
    const baseScore = simulateTrick(card, hand, trick, heartsBroken, playable, knownCards);

    // Two-trick lookahead: if we win, simulate next lead
    const lookaheadScore = twoTrickLookahead(card, hand, trick, heartsBroken, knownCards);

    // Combine
    let totalScore = baseScore + lookaheadScore * 0.4;

    // Apply aggression multiplier
    totalScore *= aggression;

    // Score awareness adjustments
    totalScore += adjustForScore(card, scoreSit, trick, heartsBroken);

    // SGR defense adjustments
    totalScore += adjustForSgrDefense(card, trick, sgrThreat, scoreSit);

    if (totalScore < bestScore) {
      bestScore = totalScore;
      bestCard = card;
    }
  }

  return bestCard;
}

// ========== Known Cards Tracker ==========

interface KnownCards {
  unknownBySuit: Map<Suit, number>;
  highCardsAlive: Map<Suit, { a: boolean; k: boolean; q: boolean; j: boolean }>;
}

function buildKnownCards(hand: Card[], trick: TrickState | null, trickCardsWon: Record<string, Card[]>): KnownCards {
  const selfIds = new Set(hand.map(c => c.id));
  const visibleIds = new Set<string>();

  // Cards in current trick
  if (trick) {
    for (const play of trick.cards) {
      visibleIds.add(play.card.id);
    }
  }

  // Cards won in previous tricks
  for (const [, cards] of Object.entries(trickCardsWon)) {
    for (const c of cards) {
      visibleIds.add(c.id);
    }
  }

  // Count remaining unknown cards per suit
  const unknownBySuit = new Map<Suit, number>();
  const highCardsAlive = new Map<Suit, { a: boolean; k: boolean; q: boolean; j: boolean }>();

  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]) {
    let count = 0;
    let hasA = false, hasK = false, hasQ = false, hasJ = false;

    for (let rank = 2; rank <= 14; rank++) {
      const id = `${suit}-${rank}`;
      if (!selfIds.has(id) && !visibleIds.has(id)) {
        count++;
        if (rank === 14) hasA = true;
        if (rank === 13) hasK = true;
        if (rank === 12) hasQ = true;
        if (rank === 11) hasJ = true;
      }
    }

    unknownBySuit.set(suit, count);
    highCardsAlive.set(suit, { a: hasA, k: hasK, q: hasQ, j: hasJ });
  }

  return { unknownBySuit, highCardsAlive };
}

// ========== Score Situation Evaluator ==========

interface ScoreSituation {
  myScore: number;
  leading: boolean;
  closestRival: number;
  gapToClosest: number;
  dangerLevel: 'safe' | 'vulnerable' | 'critical';
  gameApproaching: boolean;
}

function evaluateScoreSituation(playerId: string, scores: Record<string, number>): ScoreSituation {
  const myScore = scores[playerId] || 0;
  const rivals = Object.entries(scores)
    .filter(([id]) => id !== playerId)
    .map(([, s]) => s);

  if (rivals.length === 0) {
    return { myScore, leading: true, closestRival: 0, gapToClosest: 0, dangerLevel: 'safe', gameApproaching: false };
  }

  const maxRival = Math.max(...rivals);
  const minRival = Math.min(...rivals);

  const leading = myScore <= minRival;
  const gapToClosest = myScore - maxRival;
  const dangerLevel = myScore >= 80 ? 'critical' : myScore >= 50 ? 'vulnerable' : 'safe';
  const gameApproaching = maxRival >= 80 || myScore >= 80;

  return { myScore, leading, closestRival: maxRival, gapToClosest, dangerLevel, gameApproaching };
}

// ========== SGR Threat Detection ==========

function detectSgrThreat(trickCardsWon: Record<string, Card[]>, playerId: string): { threat: boolean; level: number } {
  let maxOpponentPoints = 0;

  for (const [oppId, cards] of Object.entries(trickCardsWon)) {
    if (oppId === playerId) continue;
    let oppPoints = 0;
    for (const c of cards) {
      if (c.suit === 'hearts') oppPoints += 1;
      if (c.suit === 'spades' && c.rank === 12) oppPoints += 13;
    }
    maxOpponentPoints = Math.max(maxOpponentPoints, oppPoints);
  }

  // If an opponent has collected 10+ points, they might be shooting the moon
  return { threat: maxOpponentPoints >= 10, level: maxOpponentPoints };
}

// ========== Aggression Multiplier ==========

function computeAggression(scoreSit: ScoreSituation, roundNumber: number): number {
  if (scoreSit.dangerLevel === 'critical' && scoreSit.leading) return 0.5; // Ultra defensive
  if (scoreSit.dangerLevel === 'critical' && !scoreSit.leading) return 2.0; // Desperate
  if (roundNumber >= 10 && scoreSit.leading) return 0.6; // Late game, protect lead
  if (roundNumber >= 10 && !scoreSit.leading) return 1.6; // Late game, catch up
  return 1.0; // Standard
}

// ========== Base Trick Simulation ==========

function simulateTrick(
  card: Card, hand: Card[], trick: TrickState | null,
  heartsBroken: boolean, playable: Card[], knownCards: KnownCards
): number {
  let score = 0;

  // --- Leading ---
  if (!trick || trick.cards.length === 0) {
    if (card.suit === 'hearts' && !heartsBroken) score += 200;
    if (card.suit === 'spades' && card.rank === 12) score += 100;
    score += card.rank * 0.1;

    // Prefer leading from shorter suits (fewer unknown cards = safer)
    const unknownCount = knownCards.unknownBySuit.get(card.suit) || 0;
    score += unknownCount * 0.3;

    // Avoid leading spades if Q♠ might still be out there
    const spadesAlive = knownCards.highCardsAlive.get('spades');
    if (card.suit === 'spades' && spadesAlive?.q) score += 5;

    return score;
  }

  // --- Following suit ---
  const leadSuit = trick.cards[0]?.card.suit;
  if (card.suit === leadSuit) {
    const ourCard = { card, playerId: 'me' };
    const allCards = [...trick.cards, ourCard];
    const tempTrick: TrickState = {
      cards: allCards, leaderId: trick.leaderId, trickNumber: trick.trickNumber,
    };
    const winner = trickWinner(tempTrick, new Map());

    if (winner === 'me') {
      let points = 0;
      for (const c of allCards) {
        if (c.card.suit === 'hearts') points += 1;
        if (c.card.suit === 'spades' && c.card.rank === 12) points += 13;
      }
      score = points * 10 + card.rank * 0.1;
      return score;
    }
    return card.rank * 0.2;
  }

  // --- Discard ---
  if (card.suit === 'hearts') {
    score = heartsBroken ? -3 : 8;
  }
  if (card.suit === 'spades' && card.rank === 12) {
    score = heartsBroken ? -20 : 10;
  }
  // Prefer dumping high non-scoring cards
  score += (15 - card.rank) * 0.5;

  return score;
}

// ========== Two-Trick Lookahead ==========

function twoTrickLookahead(
  card: Card, hand: Card[], trick: TrickState | null,
  heartsBroken: boolean, knownCards: KnownCards
): number {
  if (!trick || trick.cards.length === 0) return 0; // Can't lookahead when leading

  // Only consider lookahead if we might win this trick
  const leadSuit = trick.cards[0]?.card.suit;
  if (card.suit !== leadSuit) return 0; // We're discarding, can't win

  const ourCard = { card, playerId: 'me' };
  const allCards = [...trick.cards, ourCard];
  const tempTrick: TrickState = {
    cards: allCards, leaderId: trick.leaderId, trickNumber: trick.trickNumber,
  };
  const winner = trickWinner(tempTrick, new Map());

  if (winner !== 'me') return 0; // We lose, no lookahead needed

  // We win — simulate leading with our lowest remaining card
  const remaining = hand.filter(c => c.id !== card.id);
  if (remaining.length === 0) return 0;

  // Try leading each remaining card and find the best outcome
  let bestNextScore = Infinity;
  const candidates = remaining.slice(0, 5); // Limit to 5 for performance

  for (const nextCard of candidates) {
    const ns = simulateTrick(nextCard, remaining, null, heartsBroken, remaining, knownCards);
    bestNextScore = Math.min(bestNextScore, ns);
  }

  return bestNextScore;
}

// ========== Score-Awareness Adjustments ==========

function adjustForScore(
  card: Card, scoreSit: ScoreSituation, trick: TrickState | null, heartsBroken: boolean
): number {
  let adj = 0;

  if (scoreSit.dangerLevel === 'critical') {
    if (card.suit === 'hearts' && !heartsBroken) adj += 80;
    if (card.suit === 'spades' && card.rank === 12) adj += 40;
  }

  // If leading and game approaching, avoid any risk
  if (scoreSit.leading && scoreSit.gameApproaching) {
    if (card.suit === 'spades') adj += 3;
  }

  // If behind and critical, try harder to dump hearts/Q♠
  if (!scoreSit.leading && scoreSit.dangerLevel === 'critical') {
    if (card.suit === 'hearts' && heartsBroken) adj -= 5;
    if (card.suit === 'spades' && card.rank === 12 && heartsBroken) adj -= 10;
  }

  return adj;
}

// ========== SGR Defense Adjustments ==========

function adjustForSgrDefense(
  card: Card, trick: TrickState | null, sgrThreat: { threat: boolean; level: number },
  scoreSit: ScoreSituation
): number {
  if (!sgrThreat.threat) return 0;

  let adj = 0;
  const leadSuit = trick?.cards[0]?.card.suit;

  // If following suit and we'd win, penalize winning (don't give them more tricks)
  if (trick && trick.cards.length > 0 && card.suit === leadSuit) {
    adj += 8; // Discourage winning tricks when opponent might be shooting the moon
  }

  // If we have scoring cards, prioritize dumping them
  if (card.suit === 'hearts' && trick && trick.cards.length > 0) adj -= 10;
  if (card.suit === 'spades' && card.rank === 12 && trick && trick.cards.length > 0) adj -= 15;

  return adj;
}

// ========== Suit Count Helper ==========

function countSuitRemaining(hand: Card[], trick: TrickState | null, trickCardsWon: Record<string, Card[]>): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  const visible = new Set<string>();

  if (trick) {
    for (const play of trick.cards) visible.add(play.card.id);
  }
  for (const [, cards] of Object.entries(trickCardsWon)) {
    for (const c of cards) visible.add(c.id);
  }

  const selfIds = new Set(hand.map(c => c.id));

  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]) {
    let count = 0;
    for (let rank = 2; rank <= 14; rank++) {
      const id = `${suit}-${rank}`;
      if (!selfIds.has(id) && !visible.has(id)) count++;
    }
    counts.set(suit, count);
  }

  return counts;
}
