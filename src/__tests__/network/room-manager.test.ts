import { describe, it, expect } from 'vitest';
import { roomManager } from '../../network/room-manager';
import type { Player } from '../../game/types';

describe('RoomManager', () => {
  beforeEach(() => {
    roomManager.reset();
  });

  describe('initAsHost', () => {
    it('should initialize room as host with correct state', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');

      expect(roomManager.roomInfo?.roomId).toBe('ABC123');
      expect(roomManager.roomInfo?.hostId).toBe('host-1');
      expect(roomManager.roomInfo?.hostName).toBe('HostPlayer');
      expect(roomManager.roomInfo?.status).toBe('waiting');
      expect(roomManager.playerCount).toBe(1);
      expect(roomManager.isHost).toBe(true);
    });
  });

  describe('joinRoom', () => {
    it('should allow a player to join a room', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      const result = roomManager.joinRoom('guest-1', 'GuestPlayer');

      expect(result).toBe(true);
      expect(roomManager.playerCount).toBe(2);
      expect(roomManager.isHost).toBe(false);
    });

    it('should reject join when room is full', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');
      roomManager.joinRoom('g3', 'Player3');

      const result = roomManager.joinRoom('g4', 'Player4');
      expect(result).toBe(false);
      expect(roomManager.playerCount).toBe(4);
    });

    it('should reject join when room is playing', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');
      roomManager.joinRoom('g3', 'Player3');

      roomManager.roomInfo!.status = 'playing';
      const result = roomManager.joinRoom('g4', 'Player4');
      expect(result).toBe(false);
    });
  });

  describe('addAiPlayer', () => {
    it('should add AI player to fill empty slot', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');

      const ai = roomManager.addAiPlayer();
      expect(ai).not.toBeNull();
      expect(ai?.isAi).toBe(true);
      expect(roomManager.playerCount).toBe(3);
    });

    it('should not add AI when room is full', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');
      roomManager.joinRoom('g3', 'Player3');

      const ai = roomManager.addAiPlayer();
      expect(ai).toBeNull();
      expect(roomManager.playerCount).toBe(4);
    });

    it('should auto-add AI when room reaches 4 players', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');
      roomManager.joinRoom('g3', 'Player3');

      expect(roomManager.roomInfo?.status).toBe('starting');
    });
  });

  describe('removePlayer', () => {
    it('should remove a non-local player', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');

      // Restore localPlayerId to host after joinRoom overwrote it
      roomManager['localPlayerId'] = 'host-1';
      roomManager.aiFallbackEnabled = false;

      const removed = roomManager.removePlayer('g1');
      expect(removed?.id).toBe('g1');
      expect(roomManager.playerCount).toBe(1);
    });

    it('should reset room when local player leaves', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.removePlayer('host-1');

      expect(roomManager.roomInfo).toBeNull();
      expect(roomManager.playerCount).toBe(0);
      expect(roomManager.isHost).toBe(false);
    });
  });

  describe('canStart', () => {
    it('should return false with only 1 player', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      expect(roomManager.canStart()).toBe(false);
    });

    it('should return true with 2+ players', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      expect(roomManager.canStart()).toBe(true);
    });
  });

  describe('toGameStatePlayers', () => {
    it('should convert room players to GameState-compatible array', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.addAiPlayer();

      const players = roomManager.toGameStatePlayers();
      expect(players).toHaveLength(3);
      expect(players[0].isHuman).toBe(true);
      expect(players[1].isHuman).toBe(true);
      expect(players[2].isAi).toBe(true);
      expect(players[2].difficulty).toBe('medium');
    });
  });

  describe('reset', () => {
    it('should clear all room state', () => {
      roomManager.initAsHost('host-1', 'HostPlayer', 'ABC123');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.reset();

      expect(roomManager.roomInfo).toBeNull();
      expect(roomManager.playerCount).toBe(0);
    });
  });
});
