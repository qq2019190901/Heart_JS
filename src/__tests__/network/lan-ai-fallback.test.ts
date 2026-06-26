import { describe, it, expect } from 'vitest';
import { roomManager } from '../../network/room-manager';

describe('LAN AI Fallback', () => {
  beforeEach(() => {
    roomManager.reset();
  });

  it('should fill room with AI when players are missing', () => {
    roomManager.initAsHost('host-1', 'Host', 'ROOM1');

    // Start with only host
    expect(roomManager.playerCount).toBe(1);

    // Add 1 human player
    roomManager.joinRoom('human-1', 'HumanPlayer');
    expect(roomManager.playerCount).toBe(2);

    // Add AI to fill up to 4
    const ai1 = roomManager.addAiPlayer();
    expect(ai1?.isAi).toBe(true);
    expect(roomManager.playerCount).toBe(3);

    const ai2 = roomManager.addAiPlayer();
    expect(ai2?.isAi).toBe(true);
    expect(roomManager.playerCount).toBe(4);

    // Should not add more
    const ai3 = roomManager.addAiPlayer();
    expect(ai3).toBeNull();
  });

  it('should remove duplicate AI names', () => {
    roomManager.initAsHost('host-1', 'Host', 'ROOM1');

    roomManager.addAiPlayer();
    roomManager.addAiPlayer();
    roomManager.addAiPlayer();

    // All AI names should be unique
    const players = roomManager.roomInfo!.players;
    const aiNames = players.filter(p => p.isAi).map(p => p.name);
    const uniqueNames = new Set(aiNames);

    expect(aiNames.length).toBe(uniqueNames.size);
  });

  it('should mark room as starting when full', () => {
    roomManager.initAsHost('host-1', 'Host', 'ROOM1');
    roomManager.joinRoom('g1', 'Player1');
    roomManager.joinRoom('g2', 'Player2');
    roomManager.joinRoom('g3', 'Player3');

    expect(roomManager.roomInfo?.status).toBe('starting');
    expect(roomManager.canStart()).toBe(true);
  });

  it('should support 4-player room with all humans', () => {
    roomManager.initAsHost('h1', 'Host', 'ROOM1');
    roomManager.joinRoom('g1', 'P1');
    roomManager.joinRoom('g2', 'P2');
    roomManager.joinRoom('g3', 'P3');

    expect(roomManager.playerCount).toBe(4);
    expect(roomManager.getHumanCount()).toBe(4);
    expect(roomManager.getAiCount()).toBe(0);
  });

  it('should handle mixed human+AI configuration', () => {
    roomManager.initAsHost('h1', 'Host', 'ROOM1');
    roomManager.joinRoom('g1', 'P1');

    expect(roomManager.getHumanCount()).toBe(2); // host + guest
    expect(roomManager.getAiCount()).toBe(0);

    roomManager.addAiPlayer();
    roomManager.addAiPlayer();

    expect(roomManager.getHumanCount()).toBe(2);
    expect(roomManager.getAiCount()).toBe(2);
    expect(roomManager.playerCount).toBe(4);
  });

  describe('Client disconnect AI fallback', () => {
    it('should add AI when a non-local player disconnects', () => {
      roomManager.initAsHost('host-1', 'Host', 'ROOM1');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');

      expect(roomManager.playerCount).toBe(3);

      roomManager['localPlayerId'] = 'host-1';
      roomManager.aiFallbackEnabled = true;

      // Add an AI player
      const ai = roomManager.addAiPlayer();
      expect(ai).not.toBeNull();
      expect(roomManager.playerCount).toBe(4);
      expect(roomManager.getAiCount()).toBe(1);

      // Remove the AI player — fallback should add a replacement
      roomManager.removePlayer(ai!.id);
      // After removal, roomManager should have auto-added a replacement AI
      expect(roomManager.playerCount).toBe(4);
    });

    it('should not add AI when aiFallbackEnabled is false', () => {
      roomManager.initAsHost('host-1', 'Host', 'ROOM1');
      roomManager.joinRoom('g1', 'Player1');

      roomManager.aiFallbackEnabled = false;

      roomManager['localPlayerId'] = 'host-1';
      const removed = roomManager.removePlayer('g1');
      expect(removed).not.toBeNull();
      expect(roomManager.playerCount).toBe(1);
      expect(roomManager.getAiCount()).toBe(0);
    });
  });

  describe('Pass cache isolation', () => {
    it('should not leak pass data between rounds', () => {
      roomManager.initAsHost('host-1', 'Host', 'ROOM1');
      roomManager.joinRoom('g1', 'Player1');
      roomManager.joinRoom('g2', 'Player2');
      roomManager.joinRoom('g3', 'Player3');

      // Simulate first round pass data
      roomManager.roomInfo!.players.forEach(p => {
        p.ready = true;
      });

      roomManager.reset();

      // After reset, no stale data
      expect(roomManager.roomInfo).toBeNull();
      expect(roomManager.playerCount).toBe(0);
    });
  });
});
