import type { Card, GameState } from '../game/types';

/**
 * Wire protocol shared between the LAN host and its clients.
 *
 * Every message travels as JSON over a PeerJS DataConnection, so `Map`/`Set`
 * fields are flattened before sending (see `LanPeerManager.broadcast`).
 */

/** A `GameState` with `hands` flattened from `Map` to a plain object. */
export type SerializedGameState = Omit<GameState, 'hands'> & {
  hands: Record<string, Card[]>;
  /** Set by the lobby layer; not part of GameState proper. */
  type?: string;
};

/** Player roster entry exchanged during the lobby phase. */
export interface WirePlayer {
  id: string;
  name: string;
  isAi?: boolean;
}

/** Client → host: my three cards for this round's pass. */
export interface PassCardMessage {
  type: 'pass-card';
  cardIds: string[];
}

/** Client → host: the card I want to play. */
export interface PlayCardMessage {
  type: 'play-card';
  cardId: string;
}

/** Host → clients: authoritative player roster. */
export interface PlayerListMessage {
  type: 'player-list';
  players: WirePlayer[];
}

/** Host → clients: authoritative game state snapshot. */
export interface GameStateMessage {
  type: 'game-state';
  payload: SerializedGameState;
}

/** Any message a guest may send to the host. */
export type ClientMessage = PassCardMessage | PlayCardMessage;

/** Any message the host may send to a guest. */
export type HostMessage = PlayerListMessage | GameStateMessage;

/** Envelope delivered by `data-received`: who sent it, and what. */
export interface ReceivedMessage {
  from: string;
  payload: Partial<ClientMessage & HostMessage> & Record<string, unknown>;
}

/**
 * A message as it arrives over the wire — untyped until narrowed.
 * Callers must validate the shape before trusting any field.
 */
export type RawMessage = Record<string, unknown>;

/** Narrow an unknown wire value to an object with a string `type`. */
export function isTypedMessage(value: unknown): value is { type: string } & Record<string, unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/** Extract a `cardId` from either a wrapped payload or a flat message. */
export function readCardId(msg: RawMessage): string | undefined {
  const payload = msg.payload as Record<string, unknown> | undefined;
  const candidate = payload?.cardId ?? msg.cardId;
  return typeof candidate === 'string' ? candidate : undefined;
}

/** Extract a `cardIds` array from a pass-card message. */
export function readCardIds(msg: RawMessage): string[] | undefined {
  const payload = msg.payload as Record<string, unknown> | undefined;
  const candidate = payload?.cardIds ?? msg.cardIds;
  return Array.isArray(candidate) ? candidate.filter((c): c is string => typeof c === 'string') : undefined;
}
