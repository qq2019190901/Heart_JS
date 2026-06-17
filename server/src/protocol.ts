export const ServerToClientMsg = {
  GAME_STATE: 'game_state',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  WAIT_TURN: 'wait_turn',
  ROUND_OVER: 'round_over',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  ROOM_FULL: 'room_full',
  START_GAME: 'start_game',
  ROOM_CREATED: 'room_created',
  ROOM_JOINED: 'room_joined',
} as const;

export const ClientToServerMsg = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  PLAY_CARD: 'play_card',
  PASS_CARD: 'pass_card',
  READY: 'ready',
  CREATE_ROOM: 'create_room',
} as const;

export interface RoomConfig {
  maxPlayers: number;
  useAi: boolean;
  aiCount: number;
  aiDifficulty: 'easy' | 'medium' | 'hard';
}

export const DEFAULT_CONFIG: RoomConfig = {
  maxPlayers: 4,
  useAi: true,
  aiCount: 3,
  aiDifficulty: 'medium',
};
