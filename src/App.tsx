import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Menu } from './components/Menu/Menu';
import { CardComponent } from './components/Card/Card';
import { Table } from './components/Table/Table';
import { ScoreBoard } from './components/ScoreBoard/ScoreBoard';
import { LanLobby } from './components/Lan/LanLobby';
import { WsLobby } from './components/Multi/WsLobby';
import type { GameState, Card, Player, PassDirection } from './game/types';
import { createInitialState, dealCardsForRound, applyCardPass, playCard } from './game/hearts-game';
import { getAiDecision } from './game/ai';
import { getAiPlayDecision } from './game/ai-turn';
import { heartsAreBroken, canPlayCard, getAllPlayableCards } from './game/rules';
import { wsManager } from './multiplayer/websocket';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useResponsive } from './hooks/useResponsive';
import { lanPeer, LanPeerManager } from './network/lan-peer';
import { roomManager } from './network/room-manager';

type GameMode = 'single' | 'local' | 'multi' | 'lan';

function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState('');
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerName] = useState('玩家');
  const [waitingForAi, setWaitingForAi] = useState(false);
  const [multiStatus, setMultiStatus] = useState<'idle' | 'connecting' | 'connected' | 'in_room' | 'waiting'>('idle');
  const [multiRoomCode, setMultiRoomCode] = useState('');
  const [multiRoomPlayers, setMultiRoomPlayers] = useState<{ id: string; name: string; ready: boolean }[]>([]);
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [showPassUI, setShowPassUI] = useState(false);
  const [selectedPassCardIds, setSelectedPassCardIds] = useState<Set<string>>(new Set());
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const isMobile = useBreakpoint(768);
  const resp = useResponsive();

  // LAN state
  const [lanRoomCode, setLanRoomCode] = useState('');
  const [lanIsHost, setLanIsHost] = useState(false);
  const [lanPlayers, setLanPlayers] = useState<{ id: string; name: string; isAi: boolean }[]>([]);
  const [lanStatus, setLanStatus] = useState<'waiting' | 'ready' | 'connecting' | 'error'>('waiting');
  const [lanErrorMessage, setLanErrorMessage] = useState('');
  const [lanConnected, setLanConnected] = useState(false);
  const [lanServerHost, setLanServerHost] = useState('127.0.0.1');
  const [lanServerPort, setLanServerPort] = useState('9000');
  const [lanPassSending, setLanPassSending] = useState(false);
  const lanPlayerIdRef = useRef('');
  const lanPassConfirmedRef = useRef<Set<string>>(new Set());
  const [lanClientSentPass, setLanClientSentPass] = useState(false);
  const lanPlayersRef = useRef<{ id: string; name: string; isAi: boolean }[]>([]);

  // ========== LAN Deserializer ==========

  const deserializeLanState = useCallback((raw: any): GameState => {
    if (!raw) return {} as GameState;
    const handsRaw = raw.hands || {};
    const hands = new Map<string, Card[]>();
    for (const [k, v] of Object.entries(handsRaw)) {
      if (Array.isArray(v)) hands.set(k, v as Card[]);
    }
    return { ...raw, hands } as GameState;
  }, []);

  // ========== LAN Listeners ==========

  const lanIsHostRef = useRef(false);
  lanIsHostRef.current = lanIsHost;

  useEffect(() => {
    const onDataReceived = (data: any) => {
      const { from, payload } = data;
      console.log('[LAN] Message from', from, 'type:', payload?.type);

      const isHost = lanIsHostRef.current;

      // --- Client side: receive player list from host ---
      if (!isHost && payload?.type === 'player-list' && payload.players) {
        const remotePlayers = payload.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          isAi: false,
        }));
        setLanPlayers(remotePlayers);
        lanPlayersRef.current = remotePlayers;
        return;
      }

      // --- Host side: receive pass-card from clients ---
      if (isHost && payload?.type === 'pass-card' && payload.cardIds && from) {
        const state = gameStateRef.current;
        if (!state) return;
        const hand = state.hands.get(from) || [];
        const cardsToPass = hand.filter(c => payload.cardIds.includes(c.id));
        lanPeer._lanClientPasses = { ...lanPeer._lanClientPasses, [from]: cardsToPass };
        lanPassConfirmedRef.current.add(from);
        checkLanPassComplete();
        return;
      }

      // --- Broadcast game state from host (client-side only) ---
      if (isHost) return;
      if (payload?.phase) {
        const state = deserializeLanState(payload);
        setGameState(state);
        // Reset pass-sent flag when receiving new state from host
        setLanClientSentPass(false);
        // Set humanId for client using local player ID
        if (state.players) {
          const myPlayer = state.players.find((p: Player) => p.id === lanPlayerIdRef.current);
          if (myPlayer) setHumanId(myPlayer.id);
        }
        if (state.phase === 'passing') setShowPassUI(true);
        else if (state.phase === 'playing') setShowPassUI(false);
        if (state.phase === 'roundOver') setRoundOver(true);
        else if (state.phase === 'gameOver') setGameOver(true);
      }
    };

    const onPeerConnected = (data: any) => {
      setLanPlayers(prev => {
        if (prev.find(p => p.id === data.id)) return prev;
        const updated = [...prev, { id: data.id, name: data.name || '玩家', isAi: false }];
        lanPlayersRef.current = updated;
        return updated;
      });
      // Broadcast updated player list to all guests
      if (lanIsHostRef.current) {
        const playerList = lanPlayersRef.current.map(p => ({ id: p.id, name: p.name }));
        lanPeer.broadcastPlayerList(playerList);
      }
    };

    const onPeerDisconnected = (data: any) => {
      setLanPlayers(prev => {
        const updated = prev.filter(p => p.id !== data.id);
        lanPlayersRef.current = updated;
        return updated;
      });
      roomManager.removePlayer(data.id);
      // Broadcast updated player list to remaining guests
      if (lanIsHostRef.current) {
        const playerList = lanPlayersRef.current.filter(p => p.id !== data.id).map(p => ({ id: p.id, name: p.name }));
        lanPeer.broadcastPlayerList(playerList);
      }
      // Fill with AI if game is in progress
      if (gameState && gameState.phase === 'playing') {
        const players = roomManager.getPlayers();
        while (players.length < 4) {
          const aiIdx = players.length + 1;
          players.push({
            id: `ai-fill-${aiIdx}`,
            name: `AI ${aiIdx}`,
            score: 0,
            isAi: true,
            isHuman: false,
            difficulty: 'medium',
          });
        }
      }
    };

    const onConnectionError = () => {
      setLanStatus('error');
      setLanErrorMessage('连接错误，请重试');
    };

    lanPeer.on('data-received', onDataReceived);
    lanPeer.on('peer-connected', onPeerConnected);
    lanPeer.on('peer-disconnected', onPeerDisconnected);
    lanPeer.on('connection-error', onConnectionError);

    return () => {
      lanPeer.off('data-received', onDataReceived);
      lanPeer.off('peer-connected', onPeerConnected);
      lanPeer.off('peer-disconnected', onPeerDisconnected);
      lanPeer.off('connection-error', onConnectionError);
    };
  }, [deserializeLanState]);

  function checkLanPassComplete() {
    const state = gameStateRef.current;
    if (!state || state.phase !== 'passing' || !lanIsHostRef.current) return;
    const humanPlayerIds = state.players.filter(p => p.isHuman).map(p => p.id);
    const allConfirmed = humanPlayerIds.every(id => lanPassConfirmedRef.current.has(id));
    if (!allConfirmed) return;

    const allPassedCards = { ...state.passedCards };
    Object.assign(allPassedCards, lanPeer._lanClientPasses);
    if (lanHostPassRef.current) Object.assign(allPassedCards, lanHostPassRef.current);

    const updatedState = { ...state, passedCards: allPassedCards } as GameState;
    lanPassConfirmedRef.current.clear();
    lanPeer._lanClientPasses = {};
    lanHostPassRef.current = {};

    const finalState = applyCardPass(updatedState);
    setGameState(finalState);
    setShowPassUI(false);
    setLanPassSending(false);
    setLanClientSentPass(false);
    lanPeer.broadcast(finalState);
  }

  // ========== LAN Handlers ==========

  const lanHostPassRef = useRef<Record<string, Card[]>>({});

  const handleLanCreateRoom = useCallback((customRoomId: string) => {
    setMode('lan');

    // Set server config before connecting
    lanPeer.setServerConfig({ host: lanServerHost, port: parseInt(lanServerPort) || 9000 });

    setLanConnected(true);
    setLanStatus('waiting');
    setLanIsHost(true);
    setLanErrorMessage('');

    setLanPlayers([]);
    lanPlayersRef.current = [];

    lanPeer.initAsHost(playerName, customRoomId || undefined)
      .then((id) => {
        setLanRoomCode(id);
        console.log(`[LAN] Host room created: ${id}, my PeerJS ID:`, lanPeer.myId);
        // Now we have the real PeerJS-assigned ID
        lanPlayerIdRef.current = lanPeer.myId;
        roomManager.initAsHost(lanPeer.myId, playerName, id);
        const initialPlayers = [{ id: lanPeer.myId, name: playerName, isAi: false }];
        setLanPlayers(initialPlayers);
        lanPlayersRef.current = initialPlayers;
      })
      .catch((err) => {
        console.error('[LAN] Host init failed:', err);
        setLanStatus('error');
        setLanErrorMessage('创建房间失败，请确认PeerJS服务器已启动');
      });
  }, [playerName, lanServerHost, lanServerPort]);

  const handleLanJoinRoom = useCallback((roomCode: string) => {
    setMode('lan');
    setLanConnected(true);
    setLanStatus('connecting');
    setLanRoomCode(roomCode.toUpperCase());
    setLanIsHost(false);

    // Set server config before connecting
    lanPeer.setServerConfig({ host: lanServerHost, port: parseInt(lanServerPort) || 9000 });
    setLanErrorMessage('');

    // Don't set lanPlayerIdRef yet — wait for PeerJS to assign our real ID
    setLanPlayers([]);
    lanPlayersRef.current = [];

    lanPeer.initAsClient(playerName, roomCode.toUpperCase())
      .then((success) => {
        if (success) {
          setLanStatus('ready');
          // Now we have the real PeerJS-assigned ID
          lanPlayerIdRef.current = lanPeer.myId;
          const initialPlayers = [{ id: lanPeer.myId, name: playerName, isAi: false }];
          setLanPlayers(initialPlayers);
          lanPlayersRef.current = initialPlayers;
        } else {
          setLanStatus('error');
          setLanErrorMessage('加入房间失败，请确认房间号正确');
        }
      })
      .catch(() => {
        setLanStatus('error');
        setLanErrorMessage('连接失败，请重试');
      });
  }, [playerName]);

  const handleLanStartGame = useCallback(() => {
    if (!lanIsHost || !lanConnected) return;
    setLanStatus('ready');

    // Build player list from lanPlayersRef (which has real PeerJS IDs)
    const players: Player[] = lanPlayersRef.current.map(p => ({
      id: p.id,
      name: p.name,
      isHuman: !p.isAi,
      isAi: p.isAi,
      score: 0,
      difficulty: 'medium' as const,
    }));

    // Move host to front
    const hostPlayer = players.find(p => p.id === lanPlayerIdRef.current);
    if (hostPlayer) {
      players.splice(players.indexOf(hostPlayer), 1);
      players.unshift(hostPlayer);
    }

    // Fill remaining slots with AI
    while (players.length < 4) {
      const aiIdx = players.length + 1;
      players.push({
        id: `ai-fill-${aiIdx}`,
        name: `AI ${aiIdx}`,
        score: 0,
        isAi: true,
        isHuman: false,
        difficulty: 'medium',
      });
    }

    const state = createInitialState(players);
    setGameState(state);
    setHumanId(lanPlayerIdRef.current);

    setTimeout(() => {
      const dealt = dealCardsForRound(state, state.roundNumber);
      setGameState(dealt);
      if (dealt.phase === 'passing') setShowPassUI(true);
      lanPeer.broadcast(dealt);
    }, 500);
  }, [lanIsHost, lanConnected]);

  const handleLanLeave = useCallback(() => {
    lanPeer.disconnect();
    roomManager.reset();
    setLanRoomCode('');
    setLanIsHost(false);
    setLanPlayers([]);
    lanPlayersRef.current = [];
    setLanStatus('waiting');
    setLanConnected(false);
    setLanErrorMessage('');
    lanPassConfirmedRef.current.clear();
    setMode(null);
  }, []);

  // ========== Single/Local Handlers ==========

  const startSingle = useCallback(() => {
    const players: Player[] = [
      { id: 'human', name: playerName, isHuman: true, score: 0 },
      { id: 'ai-0', name: 'AI 左', isAi: true, difficulty: 'medium', score: 0, isHuman: false },
      { id: 'ai-1', name: 'AI 上', isAi: true, difficulty: 'medium', score: 0, isHuman: false },
      { id: 'ai-2', name: 'AI 右', isAi: true, difficulty: 'medium', score: 0, isHuman: false },
    ];
    const state = createInitialState(players);
    setHumanId('human');
    setGameState(state);
    setMode('single');
    setTimeout(() => {
      const dealt = dealCardsForRound(state, state.roundNumber);
      setGameState(dealt);
      if (dealt.phase === 'passing') {
        setShowPassUI(true);
        setSelectedPassCardIds(new Set());
      }
    }, 500);
  }, [playerName]);

  const startLocal = useCallback(() => {
    const players: Player[] = [
      { id: 'p0', name: '玩家1', isHuman: true, score: 0 },
      { id: 'p1', name: '玩家2', isHuman: true, score: 0 },
      { id: 'p2', name: '玩家3', isHuman: true, score: 0 },
      { id: 'p3', name: '玩家4', isHuman: true, score: 0 },
    ];
    const state = createInitialState(players);
    setGameState(state);
    setMode('local');
    setTimeout(() => {
      const dealt = dealCardsForRound(state, state.roundNumber);
      setGameState(dealt);
      setShowPassUI(true);
    }, 500);
  }, []);

  const startMulti = useCallback(() => {
    setMultiStatus('connecting');
    wsManager.connect(() => {
      setMultiStatus('connected');
      wsManager.createRoom(playerName);
    });
  }, [playerName]);

  const joinMultiRoom = useCallback(() => {
    if (joinRoomCode.trim().length < 3) return;
    setMultiStatus('connecting');
    wsManager.connect(() => {
      setMultiStatus('connected');
      wsManager.joinRoom(playerName, joinRoomCode.trim().toUpperCase());
    });
  }, [joinRoomCode, playerName]);

  const handleMultiReadyUp = useCallback(() => {
    wsManager.readyUp();
  }, []);

  const handleMultiLeave = useCallback(() => {
    wsManager.leaveRoom();
    wsManager.disconnect();
    setMultiStatus('idle');
    setMultiRoomCode('');
    setMultiRoomPlayers([]);
    setMode(null);
  }, []);

  const deserializeState = useCallback((raw: any): GameState | null => {
    if (!raw) return null;
    const handsRaw = raw.hands;
    const hands = new Map<string, Card[]>();
    if (handsRaw && typeof handsRaw === 'object') {
      for (const [k, v] of Object.entries(handsRaw)) {
        if (Array.isArray(v)) hands.set(k, v);
      }
    }
    return { ...raw, hands } as GameState;
  }, []);

  // ========== WebSocket Listeners ==========

  useEffect(() => {
    wsManager.on('room_created', (data) => {
      wsManager.setRoomId(data.roomId);
      setMultiRoomCode(data.roomId);
      setMultiStatus('waiting');
      setMultiRoomPlayers(data.players || []);
    });
    wsManager.on('room_joined', (data) => {
      wsManager.setRoomId(data.roomId);
      setMultiStatus('waiting');
      setMultiRoomPlayers(data.players || []);
    });
    wsManager.on('player_joined', (data) => {
      setMultiRoomPlayers(data.players || []);
    });
    wsManager.on('player_left', (data) => {
      setMultiRoomPlayers(data.players || []);
    });
    wsManager.on('start_game', (data) => {
      const state = deserializeState(data.state);
      setGameState(state);
      setHumanId(state?.players.find((p: Player) => p.isHuman)?.id ?? '');
      setMultiStatus('in_room');
      setRoundOver(false);
      setGameOver(false);
      setMultiRoomCode('');
      setMultiRoomPlayers([]);
      if (state?.phase === 'passing') setShowPassUI(true);
    });
    wsManager.on('game_state', (data) => {
      const state = deserializeState(data.state);
      setGameState(state);
      if (state?.phase === 'passing') setShowPassUI(true);
      else if (state?.phase === 'playing') {
        setShowPassUI(false);
        setSelectedPassCardIds(new Set());
      }
      if (state?.phase === 'roundOver') setRoundOver(true);
      else if (state?.phase === 'gameOver') setGameOver(true);
    });
    wsManager.on('round_over', () => setRoundOver(true));
    wsManager.on('game_over', () => setGameOver(true));
    return () => { wsManager.disconnect(); };
  }, [deserializeState]);

  // ========== LAN: AI Turn Handling ==========

  useEffect(() => {
    if (mode !== 'lan' || !gameState || gameState.phase !== 'playing') return;
    if (showPassUI) setShowPassUI(false);
    if (gameState.trickJustCompleted) return;

    const decision = getAiPlayDecision(gameState);
    if (!decision) return;

    setWaitingForAi(true);

    aiTimeoutRef.current = setTimeout(() => {
      const latestState = gameStateRef.current;
      if (!latestState || latestState.phase !== 'playing') { setWaitingForAi(false); return; }
      const latestDecision = getAiPlayDecision(latestState);
      if (!latestDecision || latestDecision.playerId !== decision.playerId) { setWaitingForAi(false); return; }

      const newState = playCard(latestState, latestDecision.playerId, latestDecision.cardId);
      setGameState(newState);
      lanPeer.broadcast(newState);
      if (newState.phase === 'roundOver') setRoundOver(true);
      else if (newState.phase === 'gameOver') setGameOver(true);
      setWaitingForAi(false);
    }, decision.delay);

    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  }, [gameState?.currentPlayerId, gameState?.phase, gameState?.trickJustCompleted, mode]);

  // ========== LAN: Handle Incoming Card Plays from Clients ==========

  useEffect(() => {
    if (mode !== 'lan' || !lanIsHost) return;

    const handleCardPlay = (data: any) => {
      const cardId = data.payload?.cardId || data.cardId;
      const senderId = data.from;
      if (!cardId || !senderId || !gameStateRef.current) return;

      const newState = playCard(gameStateRef.current, senderId, cardId);
      setGameState(newState);
      lanPeer.broadcast(newState);
      if (newState.phase === 'roundOver') setRoundOver(true);
      else if (newState.phase === 'gameOver') setGameOver(true);
    };

    const onDataReceived = (data: any) => {
      if (data.payload?.type === 'play-card' || data.type === 'play-card') {
        handleCardPlay(data);
      }
    };
    lanPeer.on('data-received', onDataReceived);

    return () => { lanPeer.off('data-received', onDataReceived); };
  }, [mode, lanIsHost]);

  // ========== Common: gameStateRef Sync ==========

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // ========== Common: AI Turn (single/local modes only) ==========

  useEffect(() => {
    if (mode !== 'single' && mode !== 'local') return;
    if (!gameState || gameState.phase !== 'playing') return;
    if (showPassUI) setShowPassUI(false);
    if (gameState.trickJustCompleted) return;

    const decision = getAiPlayDecision(gameState);
    if (!decision) return;

    setWaitingForAi(true);

    aiTimeoutRef.current = setTimeout(() => {
      const latestState = gameStateRef.current;
      if (!latestState || latestState.phase !== 'playing') { setWaitingForAi(false); return; }
      const latestDecision = getAiPlayDecision(latestState);
      if (!latestDecision || latestDecision.playerId !== decision.playerId) { setWaitingForAi(false); return; }

      const newState = playCard(latestState, latestDecision.playerId, latestDecision.cardId);
      setGameState(newState);
      if (newState.phase === 'roundOver') setRoundOver(true);
      else if (newState.phase === 'gameOver') setGameOver(true);
      setWaitingForAi(false);
    }, decision.delay);

    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  }, [gameState?.currentPlayerId, gameState?.phase, gameState?.trickJustCompleted, mode]);

  // ========== Common: Trick completion timer ==========

  useEffect(() => {
    if (!gameState || !gameState.trickJustCompleted) return;
    if (aiTimeoutRef.current) { clearTimeout(aiTimeoutRef.current); aiTimeoutRef.current = null; }
    trickTimerRef.current = setTimeout(() => {
      setGameState(prev => {
        if (!prev) return prev;
        return { ...prev, trickJustCompleted: false, currentTrick: null };
      });
    }, 1000);
    return () => { if (trickTimerRef.current) clearTimeout(trickTimerRef.current); };
  }, [gameState?.trickJustCompleted]);

  // ========== Common: Card Click Handler ==========

  const handleCardClick = useCallback((card: Card) => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentPlayerId !== humanId) return;
    if (waitingForAi) return;
    if (gameState.trickJustCompleted) return;

    const hand = gameState.hands.get(humanId) || [];
    const hb = heartsAreBroken(gameState.hands, gameState.highestHeart);
    if (!canPlayCard(card, hand, gameState.currentTrick, hb)) return;

    const newState = playCard(gameState, humanId, card.id);
    setGameState(newState);
    if (newState.phase === 'roundOver') setRoundOver(true);
    else if (newState.phase === 'gameOver') setGameOver(true);
  }, [gameState, humanId, waitingForAi]);

  // ========== Common: Continue / Restart ==========

  const handleContinue = useCallback(() => {
    if (!gameState) return;
    const nextRound = gameState.roundNumber + 1;
    const newState = createInitialState(gameState.players, nextRound);
    const prevScores = gameState.scores;
    const cumulativeScores: Record<string, number> = {};
    for (const p of newState.players) {
      cumulativeScores[p.id] = (prevScores[p.id] || 0);
    }
    newState.scores = cumulativeScores;
    setGameState(newState);
    setRoundOver(false);
    setGameOver(false);
    setShowPassUI(false);
    setSelectedPassCardIds(new Set());
    setTimeout(() => {
      const dealt = dealCardsForRound(newState, newState.roundNumber);
      setGameState(dealt);
      if (dealt.phase === 'passing') {
        setShowPassUI(true);
        setSelectedPassCardIds(new Set());
      }
      if (mode === 'lan') lanPeer.broadcast(dealt);
    }, 500);
  }, [gameState, mode]);

  const handlePassConfirm = () => {
    if (!gameState || gameState.phase !== 'passing') return;

    if (mode === 'multi') {
      wsManager.passCard(Array.from(selectedPassCardIds));
      return;
    }

    if (mode === 'lan') {
      if (lanIsHostRef.current) {
        const prevSelection = new Set(selectedPassCardIds);
        setSelectedPassCardIds(new Set());
        const humanHand = gameState.hands.get(humanId) || [];
        const selectedCards = humanHand.filter(c => prevSelection.has(c.id));
        lanHostPassRef.current[humanId] = selectedCards;
        lanPassConfirmedRef.current.add(humanId);
        setLanPassSending(true);
        checkLanPassComplete();
        return;
      } else {
        console.log('[LAN-CLIENT] Sending pass-card to host:', Array.from(selectedPassCardIds));
        lanPeer.sendToHost('pass-card', { cardIds: Array.from(selectedPassCardIds), type: 'pass-card' });
        setLanClientSentPass(true);
        // Don't close UI yet — wait for host broadcast with new phase
        setSelectedPassCardIds(new Set());
        return;
      }
      setShowPassUI(false);
      return;
    }

    // Local/single: apply locally
    const prevSelection = new Set(selectedPassCardIds);
    setSelectedPassCardIds(new Set());
    const humanHand = gameState.hands.get(humanId) || [];
    const selectedCards = humanHand.filter(c => prevSelection.has(c.id));

    const newPassedCards = { ...gameState.passedCards };
    newPassedCards[humanId] = selectedCards;
    const updatedState = { ...gameState, passedCards: newPassedCards } as GameState;

    setGameState(applyCardPass(updatedState));
  };

  const handleRestart = useCallback(() => {
    if (!gameState) return;
    const players = gameState.players.map(p => ({ ...p, score: 0 }));
    const newState = createInitialState(players as Player[], 1);
    setGameState(newState);
    setRoundOver(false);
    setGameOver(false);
    setShowPassUI(false);
    setSelectedPassCardIds(new Set());
    setTimeout(() => {
      const dealt = dealCardsForRound(newState, newState.roundNumber);
      setGameState(dealt);
      if (dealt.phase === 'passing') {
        setShowPassUI(true);
        setSelectedPassCardIds(new Set());
      }
    }, 500);
  }, [gameState]);

  // ========== Menu Screen ==========

  if (!mode) {
    return (
      <Menu
        onStartSingle={startSingle}
        onStartLanHost={handleLanCreateRoom}
        onStartLanJoin={handleLanJoinRoom}
        onStartLocal={startLocal}
      />
    );
  }

  // ========== LAN Lobby Screen ==========

  if (mode === 'lan' && lanConnected && !gameState) {
    return (
      <LanLobby
        roomId={lanRoomCode}
        playerName={playerName}
        isHost={lanIsHost}
        players={lanPlayers}
        onReady={handleLanStartGame}
        onCancel={handleLanLeave}
        status={lanStatus}
        errorMessage={lanErrorMessage}
      />
    );
  }

  // ========== WebSocket Lobby Screen ==========

  if (mode === 'multi' && multiStatus === 'waiting') {
    // Determine if local player is host (first player in room_created response)
    const isHost = multiRoomPlayers.length > 0 && multiRoomPlayers[0]?.name === playerName;
    return (
      <WsLobby
        roomId={multiRoomCode}
        playerName={playerName}
        players={multiRoomPlayers}
        onCancel={handleMultiLeave}
        onReadyUp={handleMultiReadyUp}
        isHost={isHost}
      />
    );
  }

  // ========== Game Over / Round Over ==========

  if (roundOver || gameOver) {
    const allScores = gameState?.players.map(p => ({
      id: p.id,
      name: p.name,
      score: gameState.scores[p.id] ?? 0,
    })) || [];

    return (
      <ScoreBoard
        players={allScores}
        roundNumber={gameState?.roundNumber ?? 1}
        showSummary={gameOver}
        trickCardsWon={gameState?.trickCardsWon}
        onContinue={handleContinue}
        onRestart={handleRestart}
      />
    );
  }

  // ========== Loading States ==========

  if (!gameState) {
    return (
      <div className="min-h-screen min-h-dvh bg-emerald-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">游戏中...</div>
      </div>
    );
  }

  if (gameState.phase === 'dealing') {
    return (
      <div className="min-h-screen min-h-dvh bg-emerald-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">发牌中...</div>
      </div>
    );
  }

  // ========== Passing Phase ==========

  if (gameState.phase === 'passing') {
    // DEBUG: log hands state
    console.log('[PASS PHASE] humanId:', humanId, 'handsKeys:', Array.from(gameState.hands?.keys() || []));
    const humanHand = gameState.hands.get(humanId) || [];
    console.log('[PASS PHASE] humanHand length:', humanHand.length);
    const maxPass = Math.min(3, Math.floor(humanHand.length / 4));

    const togglePassCard = (cardId: string) => {
      setSelectedPassCardIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(cardId)) newSet.delete(cardId);
        else if (newSet.size < maxPass) newSet.add(cardId);
        return newSet;
      });
    };

    const passDir: PassDirection = gameState.passedDirections[humanId] ?? 'none';
    const passLabel = passDir === 'left' ? '← 左侧玩家' : passDir === 'right' ? '→ 右侧玩家' : passDir === 'across' ? '↑ 对面玩家' : '无';
    const selectedArr = humanHand.filter(c => selectedPassCardIds.has(c.id));

    // Responsive passing phase
    const passCardMinPx = resp.isVeryCompact ? 28 : resp.isCompact ? 36 : resp.maxDim > 1200 ? 64 : 48;
    const sectionGap = resp.isVeryCompact ? '8px' : resp.isCompact ? '12px' : '24px';
    const titleSize = resp.isVeryCompact ? 'text-base' : resp.isCompact ? 'text-xl' : 'text-2xl';
    const bodySize = resp.isVeryCompact ? 'text-[10px]' : resp.isCompact ? 'text-xs' : 'text-sm';
    const btnFontSize = resp.isVeryCompact ? 'text-xs' : resp.isCompact ? 'text-sm' : 'text-base';
    const confirmBtnPadding = resp.isVeryCompact ? 'px-3 py-1.5' : resp.isCompact ? 'px-5 py-2' : 'px-6 py-2.5';

    return (
      <div className="min-h-screen min-h-dvh flex flex-col overflow-hidden" style={{
        background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)',
      }}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-2 py-1 sm:px-3 sm:py-1.5 bg-black/0 shrink-0 fixed top-0 left-0 right-0 z-50">
          <button
            className="text-white/60 hover:text-white transition-colors"
            style={resp.isCompact ? { fontSize: '11px' } : {}}
            onClick={() => setMode(null)}
          >
            ← 菜单
          </button>
          <div
            className="text-white/50 font-medium"
            style={resp.isVeryCompact ? { fontSize: '10px' } : resp.isCompact ? { fontSize: '11px' } : {}}
          >
            第 {gameState.roundNumber} 回合 — 传牌阶段
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-4 px-2 min-h-0"
          style={{ gap: sectionGap }}>
          {/* Title */}
          <div className="text-center">
            <h2 className={`text-white font-bold mb-0.5 ${titleSize}`}>传牌阶段</h2>
            <p className={`text-white/70 ${bodySize}`}>
              向 <span className="text-yellow-300 font-semibold">{passLabel}</span> 选择 {maxPass} 张牌
            </p>
          </div>

          {/* Waiting for others */}
          {mode === 'lan' && (lanClientSentPass || lanPassSending) ? (
            <div className="text-center py-4 sm:py-8">
              <div className={`text-white/70 font-semibold ${resp.isVeryCompact ? 'text-base' : 'text-lg'}`}>
                {lanPassSending ? '已传递，等待其他玩家...' : '已传递，等待其他玩家...'}
              </div>
            </div>
          ) : (
            <>
              {/* Selected cards preview */}
              {selectedArr.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1 sm:gap-2 px-2">
                  {selectedArr.map((card) => (
                    <div key={card.id} className="relative cursor-pointer" onClick={() => togglePassCard(card.id)}>
                      <CardComponent card={card} small minPx={passCardMinPx} />
                      <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-red-500 text-white text-[8px] sm:text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-bold shadow-md">✕</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-white/50 italic ${bodySize}`}>请选择要传递的牌</div>
              )}

              {/* Hand */}
              <div className="w-full max-w-lg px-1">
                <div className={`text-white/50 text-center mb-1 ${bodySize}`}>你的手牌（点击选择）</div>
                <div
                  className="flex items-end justify-center gap-0.5 flex-wrap"
                  style={{ maxHeight: `clamp(100px, 40dvh, ${resp.isVeryCompact ? '140px' : '250px'})` }}
                >
                  {humanHand.map((card, idx) => {
                    const isSelected = selectedPassCardIds.has(card.id);
                    return (
                      <div
                        key={card.id}
                        className={`transition-all duration-200 ${isSelected ? 'opacity-50' : ''}`}
                        style={{
                          transform: isSelected ? 'scale(0.9)' : undefined,
                          marginLeft: idx > 0 ? -6 : 0,
                          cursor: isSelected || selectedPassCardIds.size < maxPass ? 'pointer' : 'default',
                        }}
                        onClick={() => togglePassCard(card.id)}
                      >
                        <CardComponent card={card} small minPx={passCardMinPx} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={handlePassConfirm}
                disabled={selectedPassCardIds.size !== maxPass}
                className={`font-bold rounded-lg transition-colors shadow-lg ${confirmBtnPadding} ${btnFontSize} ${
                  selectedPassCardIds.size === maxPass
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
              >
                确认传递 ✓
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ========== Playing Phase ==========

  const humanHand = gameState.hands.get(humanId) || [];
  const playableIds = new Set(
    getAllPlayableCards(humanHand, gameState.currentTrick, heartsAreBroken(gameState.hands, gameState.highestHeart)).map(c => c.id)
  );

  // Responsive hand layout — scales with viewport
  const handGap = resp.isVeryCompact ? -4 : resp.isCompact ? -8 : undefined;
  const handMaxH = resp.vh < 450 ? '100px' : resp.vh < 600 ? '130px' : resp.vh < 800 ? '160px' : '100dvh';
  const topBarFontSize = resp.isVeryCompact ? '11px' : resp.isCompact ? '12px' : '';
  const statusFontSize = resp.isVeryCompact ? '10px' : resp.isCompact ? '12px' : '';
  const cardMinPx = resp.isVeryCompact ? 30 : resp.isCompact ? 40 : 48;
  // On large screens, give hand more height budget
  const handMaxHFixed = resp.maxDim > 1200 ? '220px' : resp.maxDim > 900 ? '180px' : undefined;

  return (
    <div className="relative w-full h-full flex flex-col" style={{
      background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)',
    }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 bg-black/0 shrink-0 fixed top-0 left-0 right-0 z-50">
        <button
          className="text-white/60 hover:text-white transition-colors"
          style={topBarFontSize ? { fontSize: topBarFontSize } : {}}
          onClick={() => setMode(null)}
        >
          ← 菜单
        </button>
        <div
          className="text-white/70 font-medium"
          style={topBarFontSize ? { fontSize: topBarFontSize } : {}}
        >
          {mode === 'lan' ? `LAN · ${lanRoomCode}` : `第 ${gameState.roundNumber} 回合`}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 flex items-center justify-center p-1 sm:p-4 min-h-0 overflow-hidden">
        <Table
          trick={gameState.currentTrick}
          currentPlayerId={gameState.currentPlayerId}
          humanPlayerId={humanId}
          players={gameState.players.map(p => ({
            id: p.id, name: p.name, score: gameState.scores[p.id] ?? 0, isAi: !!p.isAi,
          }))}
          aiHands={gameState.hands}
        />
      </div>

      {/* Bottom: status + hand */}
      <div className="shrink-0 flex flex-col items-center px-1 sm:px-4 pb-2 sm:pb-3 pt-2">
        {/* Turn status */}
        <div
          className="h-5 sm:h-6 flex items-center justify-center shrink-0 w-full mb-0.5 sm:mb-1"
          style={{ fontSize: statusFontSize }}
        >
          {gameState.currentPlayerId === humanId && !waitingForAi && (
            <div className="text-green-300 animate-pulse font-semibold">轮到你了！</div>
          )}
          {waitingForAi && <div className="text-white/50">AI 思考中...</div>}
          {!waitingForAi && gameState.currentPlayerId !== humanId && (
            <div className="text-white/40">
              {gameState.players.find(p => p.id === gameState.currentPlayerId)?.name || ''} 的回合
            </div>
          )}
        </div>

        {/* Player hand */}
        <div
          className="flex items-end justify-center flex-wrap gap-0.5 sm:gap-1 px-1 sm:px-2"
          style={{
            maxHeight: handMaxHFixed ?? handMaxH,
            gap: handGap,
          }}
        >
          {humanHand.map((card) => {
            const playable = playableIds.has(card.id);
            const isCurrentPlayer = gameState.currentPlayerId === humanId;
            return (
              <div
                key={card.id}
                className="transition-transform duration-150"
                style={{
                  transform: !playable && isCurrentPlayer ? 'scale(0.92) brightness(0.7)' : undefined,
                }}
              >
                <CardComponent
                  card={card}
                  onClick={() => {
                    if (isCurrentPlayer && playable) {
                      if (mode === 'multi') wsManager.playCard(card.id);
                      else if (mode === 'lan') lanPeer.sendToHost('play-card', { cardId: card.id, type: 'play-card' });
                      else handleCardClick(card);
                    }
                  }}
                  disabled={!isCurrentPlayer || waitingForAi || (!playable && isCurrentPlayer)}
                  animate={false}
                  small={resp.isCompact}
                  minPx={cardMinPx}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
