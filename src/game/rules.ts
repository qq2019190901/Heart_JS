import type { Card, Suit, TrickState } from './types';

export function getLeadSuit(trick: TrickState | null): Suit | null {
  return trick?.cards[0]?.card.suit ?? null;
}

export function canPlayCard(card: Card, hand: Card[], trick: TrickState | null, heartsBroken: boolean): boolean {
  const leadSuit = getLeadSuit(trick);

  // First trick of the round
  if (!trick || trick.cards.length === 0) {
    // If hearts are broken, can play any card
    if (heartsBroken) {
      return true;
    }
    // Must play 2♣ in first trick (enforced by game engine via leader selection)
    const hasTwoOfClubs = hand.some(c => c.suit === 'clubs' && c.rank === 2);
    if (hasTwoOfClubs) {
      return card.suit === 'clubs' && card.rank === 2;
    }
    // Check if there's any safe card in the hand (non-heart and non-QS)
    const safeCards = hand.filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12));
    if (safeCards.length > 0) {
      // There are safe options -- this card must be safe to play
      if (card.suit === 'hearts') return false;
      if (card.suit === 'spades' && card.rank === 12) return false;
      return true;
    }
    // No safe alternatives exist, this card is the only option
    return true;
  }

  // Must follow suit
  if (card.suit === leadSuit) {
    return true;
  }

  // If we have the lead suit, must play it
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    return false;
  }

  // Can play anything if we don't have the lead suit
  return true;
}

export function heartsAreBroken(hands: Map<string, Card[]>): boolean {
  for (const [, cards] of hands) {
    if (cards.some(c => c.suit === 'hearts')) return true;
  }
  return false;
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
