import type {
  GameState,
  Card,
  TrickState,
  Player,
  PassDirection,
} from './types';
import { createDeck, dealCards } from './deck';
import { isShotGunTheRose } from './rules';

export function createInitialState(players: Player[], roundNumber: number = 1): GameState {
  return {
    players,
    deck: createDeck(),
    hands: new Map(),
    currentTrick: null,
    phase: 'dealing' as const,
    currentPlayerId: '',
    leadSuit: null,
    passedDirections: {},
    passedCards: {},
    scores: {},
    roundNumber,
    queenOfSpadesPlayed: false,
    highestHeart: null,
    trickCardsWon: {},
    trickJustCompleted: false,
  };
}

// Deal cards and determine what to pass (UI shows pendingPassCards)
export function dealCardsForRound(state: GameState, roundNumber: number): GameState {
  const newState = { ...state, roundNumber } as GameState;
  const playerIds = newState.players.map(p => p.id);
  const hands = dealCards(newState.deck, playerIds);
  newState.hands = hands;
  newState.deck = [];
  newState.phase = 'passing';
  newState.currentTrick = null;
  newState.leadSuit = null;
  newState.queenOfSpadesPlayed = false;
  newState.highestHeart = null;
  newState.trickCardsWon = {};

  // Determine pass direction and cards to pass
  // Standard Hearts passing cycle: L, Across, R, None, repeat
  const passCycle = ['left', 'across', 'right', 'none'] as const;
  const passDir = passCycle[(roundNumber - 1) % 4] as PassDirection;
  newState.passedDirections = {};
  newState.passedCards = {};

  if (passDir !== 'none') {
    for (const player of newState.players) {
      newState.passedDirections[player.id] = passDir;
      const hand = hands.get(player.id) || [];
      const toPass = passCards(hand, passDir);
      newState.passedCards[player.id] = toPass;
    }
  } else {
    for (const player of newState.players) {
      newState.passedDirections[player.id] = 'none';
    }
  }

  return newState;
}

// After human confirms passing, apply the card exchange
export function applyCardPass(state: GameState): GameState {
  const newState = { ...state } as GameState;
  const hands = new Map(newState.hands);
  const passDir = state.passedDirections[state.players[0].id];

  if (passDir === 'none') {
    // No passing, start playing immediately
    hands.forEach((hand, pid) => hands.set(pid, [...hand]));
    newState.hands = hands;
    return startPlaying(newState);
  }

  // For each player, remove passed cards and receive from the source
  for (let i = 0; i < newState.players.length; i++) {
    const pid = newState.players[i].id;
    const toPass = newState.passedCards[pid] || [];
    let updatedHand = (hands.get(pid) || []).filter(c => !toPass.includes(c));

    // Who passes TO us?
    let receiveFromIdx: number;
    if (passDir === 'left') {
      // Player j passes to (j+1), so we receive from (i-1)
      receiveFromIdx = (i - 1 + newState.players.length) % newState.players.length;
    } else if (passDir === 'right') {
      // Player j passes to (j-1), so we receive from (i+1)
      receiveFromIdx = (i + 1) % newState.players.length;
    } else if (passDir === 'across') {
      // Player j passes to opposite (j+2 mod 4), so we receive from (i-2 mod 4)
      receiveFromIdx = (i - 2 + newState.players.length) % newState.players.length;
    } else {
      receiveFromIdx = i; // shouldn't happen since passDir==='none' returns early
    }
    const received = newState.passedCards[newState.players[receiveFromIdx].id] || [];
    updatedHand = [...updatedHand, ...received];
    updatedHand.sort(sortHand);
    hands.set(pid, updatedHand);
  }

  newState.hands = hands;
  return startPlaying(newState);
}

function startPlaying(state: GameState): GameState {
  const newState = { ...state } as GameState;
  newState.phase = 'playing';

  // Find 2♣ leader
  const twoOfClubs = findTwoOfClubs(newState.hands);
  newState.currentPlayerId = twoOfClubs ?? newState.players[0].id;
  return newState;
}

function sortHand(a: Card, b: Card): number {
  const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
  const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  if (suitDiff !== 0) return suitDiff;
  return a.rank - b.rank;
}

function passCards(hand: Card[], direction: PassDirection): Card[] {
  const cardsToPass: Card[] = [];
  const count = Math.min(3, Math.floor(hand.length / 4));

  if (direction === 'right') {
    // Pass strongest suits (most cards)
    const suitCounts = new Map<string, number>();
    for (const c of hand) {
      suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
    }
    const sortedSuits = Array.from(suitCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    for (const [suit] of sortedSuits) {
      const suitCards = hand.filter(c => c.suit === suit)
        .sort((a, b) => b.rank - a.rank);
      const toTake = Math.min(count - cardsToPass.length, suitCards.length);
      cardsToPass.push(...suitCards.slice(0, toTake));
      if (cardsToPass.length >= count) break;
    }
  } else if (direction === 'left' || direction === 'across') {
    // Pass highest-ranked safe cards (excluding hearts and Q of Spades)
    const suitCards: Card[] = [...hand]
      .filter(c => c.suit !== 'hearts' && !(c.suit === 'spades' && c.rank === 12))
      .sort((a, b) => b.rank - a.rank);
    cardsToPass.push(...suitCards.slice(0, count));
  }

  return cardsToPass;
}

function findTwoOfClubs(hands: Map<string, Card[]>): string | null {
  for (const [playerId, cards] of hands) {
    if (cards.some(c => c.suit === 'clubs' && c.rank === 2)) {
      return playerId;
    }
  }
  return null;
}

// Keep startRound for backward compat (deals + applies passing in one step)
export function startRound(state: GameState): GameState {
  const dealt = dealCardsForRound(state, state.roundNumber);
  return applyCardPass(dealt);
}

export function playCard(state: GameState, playerId: string, cardId: string): GameState {
  const newState = { ...state };
  const hand = newState.hands.get(playerId);
  if (!hand) {
    console.warn('[PLAYCARD] No hand found for player:', playerId);
    return newState;
  }

  const cardIndex = hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) {
    console.warn('[PLAYCARD] Card not in hand:', { cardId, playerId });
    return newState;
  }

  const card = hand[cardIndex];
  const newHand = [...hand];
  newHand.splice(cardIndex, 1);
  newState.hands = new Map(newState.hands);
  newState.hands.set(playerId, newHand);

  // If trickJustCompleted is true, clear the old trick and start a new one
  if (newState.trickJustCompleted) {
    newState.currentTrick = null;
    newState.trickJustCompleted = false;
    newState.leadSuit = null;
  }

  // Update or create trick
  let trick = newState.currentTrick;
  if (!trick) {
    trick = {
      cards: [{ card, playerId }],
      leaderId: playerId,
      trickNumber: (newState.roundNumber - 1) * 13 + 1,
    };
    newState.leadSuit = card.suit;
  } else {
    trick = {
      ...trick,
      cards: [...trick.cards, { card, playerId }],
    };
  }
  newState.currentTrick = trick;
  console.log('[PLAYCARD]', playerId, 'played', card.suit, card.rank, '| trick now:', trick.cards.length, '/ 4');

  // Track hearts broken: a heart played as discard (not lead suit) breaks hearts
  if (card.suit === 'hearts' && newState.leadSuit !== 'hearts') {
    newState.highestHeart = card;
  }
  if (card.suit === 'spades' && card.rank === 12) {
    newState.queenOfSpadesPlayed = true;
  }

  // NOTE: trickJustCompleted blocking is handled at the UI layer (App.tsx),
  // not here. playCard is pure game logic — it should always process the card.

  // Check if trick is complete
  if (trick.cards.length === newState.players.length) {
    // Trick complete: determine winner, award points, advance to next trick
    const leadSuit = trick.cards[0].card.suit;
    let winningIndex = 0;
    for (let i = 1; i < trick.cards.length; i++) {
      if (trick.cards[i].card.suit === leadSuit) {
        if (trick.cards[i].card.rank > trick.cards[winningIndex].card.rank) {
          winningIndex = i;
        }
      }
    }
    const winnerId = trick.cards[winningIndex].playerId;

    // Track cards won by each player (for SGR detection)
    newState.trickCardsWon = { ...newState.trickCardsWon };
    newState.trickCardsWon[winnerId] = [
      ...(newState.trickCardsWon[winnerId] || []),
      ...trick.cards.map(c => c.card),
    ];

    // Award trick points to winner
    let trickPoints = 0;
    for (const play of trick.cards) {
      if (play.card.suit === 'hearts') trickPoints += 1;
      if (play.card.suit === 'spades' && play.card.rank === 12) trickPoints += 13;
    }

    newState.scores = { ...newState.scores };
    newState.scores[winnerId] = (newState.scores[winnerId] || 0) + trickPoints;
    console.log('[SCORE] Trick winner:', winnerId, '+', trickPoints, 'pts, total:', newState.scores[winnerId]);

    // Mark trick as just completed (UI will show all 4 cards for 1 sec)
    newState.trickJustCompleted = true;

    // Check for round over (all cards played)
    const allEmpty = Array.from(newState.hands.values()).every(h => h.length === 0);
    if (allEmpty) {
      return finishRound(newState);
    }

    // Next trick leader is the trick winner
    // Keep currentTrick visible for 1 second (trickJustCompleted flag)
    newState.currentPlayerId = winnerId;
    newState.leadSuit = null;
    newState.phase = 'playing';
  } else {
    // Trick not complete: advance to next player in round-robin order
    const currentPlayerIdx = newState.players.findIndex(p => p.id === playerId);
    const nextPlayerIdx = (currentPlayerIdx + 1) % newState.players.length;
    newState.currentPlayerId = newState.players[nextPlayerIdx].id;
  }

  return newState;
}

function finishRound(state: GameState): GameState {
  const newState = { ...state };

  // Check Shot Gun The Rose (shoot the moon)
  const sgr = isShotGunTheRose(newState.trickCardsWon);
  if (sgr.found) {
    const scores = { ...newState.scores };
    // Holder gets 0 points; all others get +26
    for (const pid of newState.players.map(p => p.id)) {
      if (pid !== sgr.holderId) {
        scores[pid] = (scores[pid] || 0) + 26;
      }
    }
    newState.scores = scores;
  }

  // Check game over (cumulative score >= 100)
  let gameOver = false;
  for (const [, score] of Object.entries(newState.scores)) {
    if (score >= 100) {
      gameOver = true;
      break;
    }
  }

  newState.phase = gameOver ? 'gameOver' as const : 'roundOver' as const;
  return newState;
}
