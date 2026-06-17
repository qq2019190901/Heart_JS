export const GAME_PORT = 3001;
export const WEBSOCKET_URL = `ws://localhost:${GAME_PORT}`;

// Client -> Server messages
export const ClientMsg = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAY_CARD: 'play_card',
  PASS_CARD: 'pass_card',
  READY: 'ready',
} as const;

// Server -> Client messages
export const ServerMsg = {
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STATE: 'game_state',
  WAIT_TURN: 'wait_turn',
  ROUND_OVER: 'round_over',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  ROOM_FULL: 'room_full',
  START_GAME: 'start_game',
} as const;

export interface CreateRoomMsg {
  type: typeof ClientMsg.CREATE_ROOM;
  playerName: string;
}

export interface JoinRoomMsg {
  type: typeof ClientMsg.JOIN_ROOM;
  playerName: string;
  roomId: string;
}

export interface PlayCardMsg {
  type: typeof ClientMsg.PLAY_CARD;
  cardId: string;
}

export interface PassCardMsg {
  type: typeof ClientMsg.PASS_CARD;
  cardIds: string[];
}

export interface LeaveRoomMsg {
  type: typeof ClientMsg.LEAVE_ROOM;
}

export interface ReadyMsg {
  type: typeof ClientMsg.READY;
}

export type ClientMessage = CreateRoomMsg | JoinRoomMsg | PlayCardMsg | PassCardMsg | LeaveRoomMsg | ReadyMsg;
