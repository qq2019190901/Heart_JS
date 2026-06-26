import type { Card, Suit, TrickState } from './types';

export function getLeadSuit(trick: TrickState | null): Suit | null {
  return trick?.cards[0]?.card.suit ?? null;
}

export function canPlayCard(card: Card, hand: Card[], trick: TrickState | null, heartsBroken: boolean): boolean {
  const leadSuit = getLeadSuit(trick);

  // First trick of the round: must play 2♣, no exceptions
  if (!trick || trick.cards.length === 0) {
    const hasTwoOfClubs = hand.some(c => c.suit === 'clubs' && c.rank === 2);
    if (hasTwoOfClubs) {
      return card.suit === 'clubs' && card.rank === 2;
    }
    // No 2♣ in hand (shouldn't happen in a fair deal), allow any card
    return true;
  }

  // Following suit: must follow if possible
  if (card.suit === leadSuit) {
    return true;
  }

  // Have lead suit but trying to play different suit — forbidden
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    return false;
  }

  // Don't have lead suit — can play anything (including hearts as discard)
  return true;
}

/**
 * Hearts are broken when a player has discarded a heart
 * (i.e., played a heart while unable to follow the lead suit).
 * This is tracked via GameState.highestHeart — if a heart has been
 * played as a discard (not as lead suit), hearts are broken.
 *
 * Simpler approach: pass a `heartsBroken` flag from GameState.
 */
export function heartsAreBroken(hands: Map<string, Card[]>, highestHeart: Card | null): boolean {
  return highestHeart !== null;
}

export function trickWinner(trick: TrickState, _hands: Map<string, Card[]>): string {
  if (trick.cards.length === 0) return '';
  const leadSuit = trick.cards[0].card.suit;
  let winningIndex = 0;
  for (let i = 1; i < trick.cards.length; i++) {
    if (trick.cards[i].card.suit === leadSuit) {
      if (trick.cards[i].card.rank > trick.cards[winningIndex].card.rank) {
        winningIndex = i;
      }
    }
  }
  return trick.cards[winningIndex].playerId;
}

export function calculateRoundPoints(hands: Map<string, Card[]>): Record<string, number> {
  const points: Record<string, number> = {};
  for (const [playerId, cards] of hands) {
    let score = 0;
    for (const card of cards) {
      if (card.suit === 'hearts') score += 1;
      if (card.suit === 'spades' && card.rank === 12) score += 13;
    }
    points[playerId] = score;
  }
  return points;
}

export function isShotGunTheRose(cardsByPlayer: Map<string, Card[]> | Record<string, Card[]>): { found: boolean; holderId: string | null } {
  const holderMap = new Map<string, { hearts: number; qs: number }>();
  for (const [pid, cards] of (cardsByPlayer instanceof Map ? cardsByPlayer : Object.entries(cardsByPlayer))) {
    const hearts = cards.filter(c => c.suit === 'hearts').length;
    const qs = cards.filter(c => c.suit === 'spades' && c.rank === 12).length;
    holderMap.set(pid, { hearts, qs });
  }

  let totalHearts = 0;
  let totalQS = 0;
  for (const [, { hearts, qs }] of holderMap) {
    totalHearts += hearts;
    totalQS += qs;
  }

  if (totalHearts !== 13 || totalQS !== 1) {
    return { found: false, holderId: null };
  }

  for (const [pid, { hearts, qs }] of holderMap) {
    if (hearts === 13 && qs === 1) {
      return { found: true, holderId: pid };
    }
  }

  return { found: false, holderId: null };
}

export function getAllPlayableCards(hand: Card[], trick: TrickState | null, heartsBroken: boolean): Card[] {
  return hand.filter(card => canPlayCard(card, hand, trick, heartsBroken));
}
