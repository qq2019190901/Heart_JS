import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { MotionConfig } from 'framer-motion';
import { Menu } from './components/Menu/Menu';
import { CardComponent } from './components/Card/Card';
import { Table } from './components/Table/Table';
import { LanLobby } from './components/Lan/LanLobby';
import type { GameState, Card, Player, PassDirection } from './game/types';
import { createInitialState, dealCardsForRound, buildDealState, applyCardPass, playCard } from './game/hearts-game';
import { dealCardsRaw, sortHand } from './game/deck';
import { getAiDecision } from './game/ai';
import { getAiPlayDecision } from './game/ai-turn';
import { heartsAreBroken, canPlayCard, getAllPlayableCards, isShotGunTheRose } from './game/rules';
import { useResponsive } from './hooks/useResponsive';
import { lanPeer, LanPeerManager } from './network/lan-peer';

type GameMode = 'single' | 'lan';

// Card sort comparator (same order as sortHand in deck.ts)
const SUIT_ORDER: string[] = ['spades', 'hearts', 'diamonds', 'clubs'];
function cardSort(a: Card, b: Card): number {
  const sd = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
  if (sd !== 0) return sd;
  return a.rank - b.rank;
}

function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState('');
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerName] = useState('玩家');
  const [waitingForAi, setWaitingForAi] = useState(false);
  const [showPassUI, setShowPassUI] = useState(false);
  const [selectedPassCardIds, setSelectedPassCardIds] = useState<Set<string>>(new Set());
  const [aiDifficulties, setAiDifficulties] = useState<Record<string, 'easy' | 'medium' | 'hard'>>(() => {
    try {
      const saved = localStorage.getItem('heart-ai-difficulties');
      return saved ? JSON.parse(saved) : { 'ai-0': 'medium', 'ai-1': 'medium', 'ai-2': 'medium' };
    } catch {
      return { 'ai-0': 'medium', 'ai-1': 'medium', 'ai-2': 'medium' };
    }
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [theme, setTheme] = useState<'classic' | 'modern'>(() => {
    try { return localStorage.getItem('heart-theme') as any || 'classic'; } catch { return 'classic'; }
  });

  // Deal animation state
  const [dealCount, setDealCount] = useState(0); // unified counter to trigger re-render on every card deal
  const isDealingRef = useRef(false);
  const dealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Shuffled deck for animation display
  const [shuffledDeck, setShuffledDeck] = useState<Card[]>([]);
  // Per-player deal data — single mutable ref, state only used to trigger re-render on human card
  const dealPerPlayerRef = useRef<Record<string, Card[]>>({});

  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
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

  // Persist AI difficulties
  useEffect(() => {
    localStorage.setItem('heart-ai-difficulties', JSON.stringify(aiDifficulties));
  }, [aiDifficulties]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
    localStorage.setItem('heart-theme', theme);
  }, [theme]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = () => setShowDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showDropdown]);

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
        lanPeer.clientPasses = { ...lanPeer.clientPasses, [from]: cardsToPass };
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
      // If game is in progress, notify host to end the round
      const hasActiveGame = gameStateRef.current?.phase === 'playing' ||
                            gameStateRef.current?.phase === 'passing';
      setLanPlayers(prev => {
        const updated = prev.filter(p => p.id !== data.id);
        lanPlayersRef.current = updated;
        return updated;
      });
      // Broadcast updated player list to remaining guests
      if (lanIsHostRef.current) {
        const playerList = lanPlayersRef.current.filter(p => p.id !== data.id).map(p => ({ id: p.id, name: p.name }));
        lanPeer.broadcastPlayerList(playerList);
        // If a player left during a game, end the current round and restart
        if (hasActiveGame) {
          setLanErrorMessage(`${data.name || '一名玩家'} 已断开，本局结束`);
          setRoundOver(true);
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
    Object.assign(allPassedCards, lanPeer.clientPasses);
    if (lanHostPassRef.current) Object.assign(allPassedCards, lanHostPassRef.current);

    const updatedState = { ...state, passedCards: allPassedCards } as GameState;
    lanPassConfirmedRef.current.clear();
    lanPeer.clientPasses = {};
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
    setGameState(null);
    setRoundOver(false);
    setGameOver(false);
    setShowPassUI(false);
    setSelectedPassCardIds(new Set());

    setLanConnected(true);
    setLanStatus('waiting');
    setLanIsHost(true);
    setLanErrorMessage('');

    setLanPlayers([]);
    lanPlayersRef.current = [];

    // initAsHost will auto-resolve Android local IP via resolveServerConfig()
    lanPeer.initAsHost(playerName, customRoomId || undefined)
      .then((id) => {
        setLanRoomCode(id);
        console.log(`[LAN] Host room created: ${id}, my PeerJS ID:`, lanPeer.myId, 'server:', lanPeer.serverConfig.host);
        // Now we have the real PeerJS-assigned ID
        lanPlayerIdRef.current = lanPeer.myId;
        const initialPlayers = [{ id: lanPeer.myId, name: playerName, isAi: false }];
        setLanPlayers(initialPlayers);
        lanPlayersRef.current = initialPlayers;
      })
      .catch((err) => {
        console.error('[LAN] Host init failed:', err);
        setLanStatus('error');
        setLanErrorMessage('创建房间失败，请确认PeerJS服务器已启动');
      });
  }, [playerName]);

  const handleLanJoinRoom = useCallback((roomCode: string, serverHost: string, serverPort: string) => {
    setMode('lan');
    setGameState(null);
    setRoundOver(false);
    setGameOver(false);
    setShowPassUI(false);
    setSelectedPassCardIds(new Set());
    setLanConnected(true);
    setLanStatus('connecting');
    setLanRoomCode(roomCode.toUpperCase());
    setLanIsHost(false);

    // Clear old saved server config so new IP is used
    try { localStorage.removeItem('heart-lan-server'); } catch {}

    const targetHost = serverHost?.trim() || '127.0.0.1';
    const targetPort = parseInt(serverPort) || 9000;
    lanPeer.setServerConfig({ host: targetHost, port: targetPort });
    setLanServerHost(targetHost);
    setLanServerPort(targetPort.toString());
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

  // ========== LAN: Add AI Player ==========

  const handleAddAi = useCallback(() => {
    if (!lanIsHost || !lanConnected) return;
    const aiCount = lanPlayersRef.current.filter(p => p.isAi).length;
    if (aiCount >= 3) return; // max 3 AI + 1 human
    const aiIdx = aiCount + 1;
    const newPlayer = { id: `ai-fill-${aiIdx}`, name: `AI ${aiIdx}`, isAi: true };
    const updated = [...lanPlayersRef.current, newPlayer];
    setLanPlayers(updated);
    lanPlayersRef.current = updated;
    lanPeer.broadcastPlayerList(updated.map(p => ({ id: p.id, name: p.name })));
  }, [lanIsHost, lanConnected]);

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

    const state = createInitialState(players);
    setGameState(state);
    setHumanId(lanPlayerIdRef.current);
    // Broadcast full player list + game state to clients
    lanPeer.broadcast(state);
  }, [lanIsHost, lanConnected]);

  const handleLanLeave = useCallback(() => {
    lanPeer.disconnect();
    setLanRoomCode('');
    setLanIsHost(false);
    setLanPlayers([]);
    lanPlayersRef.current = [];
    setLanStatus('waiting');
    setLanConnected(false);
    setLanErrorMessage('');
    lanPassConfirmedRef.current.clear();
    setGameState(null);
    setRoundOver(false);
    setGameOver(false);
    setShowPassUI(false);
    setSelectedPassCardIds(new Set());
    setMode(null);
  }, []);

  // ========== Safe hand gap (must be before conditional returns — hooks rule) ==========

  // Must be defined here for hooks ordering (before any conditional returns)
  const humanHandLen = gameState ? (gameState.hands?.get(humanId) || []).length : 0;

  // ═══════════════════════════════════════════════════════════
  // TABLE RESPONSIVE PARAMS — computed here, passed to Table
  // ═══════════════════════════════════════════════════════════

  // Card width: sized for 13 cards, never shrinks as cards are played
  const cardMinPx = useMemo(() => {
    const targetRatio = 0.25;
    const viewportArea = resp.vw * resp.vh;
    const cardW = Math.sqrt(viewportArea * targetRatio / (1.5 * 13));
    return Math.round(Math.max(30, Math.min(cardW, 120)));
  }, [resp.vw, resp.vh]);

  // Final rendered card width — what CSS actually uses
  const cardW = Math.round(cardMinPx);

  // Hand overlap gap: cards overlap by this amount (negative = overlap)
  const handSafeGap = useMemo(() => {
    // Start with 5px overlap, increase by 1px if total span exceeds available width
    const availW = resp.vw - 32;
    const numCards = 13;
    let safeGap = -5;
    // First card has marginLeft: 0, remaining 12 cards each add (cardW + safeGap)
    let totalSpan = cardW + (numCards - 1) * (cardW + safeGap);
    while (totalSpan > availW) {
      safeGap -= 1;
      totalSpan = cardW + (numCards - 1) * (cardW + safeGap);
    }
    return { safeGap };
  }, [cardW, resp.vw]);
  const tableT = useMemo(() => {
    const d = Math.max(300, Math.min(resp.vw, resp.vh));
    return (d - 300) / 1100;
  }, [resp.vw, resp.vh]);

  const tableParams = useMemo(() => {
    const aiCardMinPx = Math.round(28 + tableT * 72);
    const _cardW = Math.max(aiCardMinPx, Math.round(resp.vw * 0.09));
    const _cardH = Math.max(aiCardMinPx * 2, Math.round(resp.vh * 0.126));
    // Trick cards are larger than AI hand cards
    const trickCardMinPx = Math.round(aiCardMinPx * 1.6);
    return {
      aiCardMinPx,
      trickCardMinPx,
      cardW: _cardW,
      cardH: _cardH,
      // Tighter AI hand offset to maximize table space (was max 16–32px)
      aiHandOffset: Math.max(10, Math.round(4 + tableT * 30)),
      trickOverlapBase: Math.round(12 + tableT * 24),
      trickOverlapStep: Math.max(8, Math.round(8 + tableT * 14)),
      // Tighter badge offset to preserve horizontal space (was 8–18px)
      badgeOff: Math.round(4 + tableT * 5),
      badgeFontSizePx: Math.round(9 + tableT * 5),
      scoreFontSizePx: Math.round(8 + tableT * 4),
      fanStepX: Math.round(_cardW * 0.22),
      fanStepY: Math.round(_cardH * 0.22),
    };
  }, [tableT, resp.vw, resp.vh]);

  // ========== Single/Local Handlers ==========

  const startSingle = useCallback(() => {
    const players: Player[] = [
      { id: 'human', name: playerName, isHuman: true, score: 0 },
      { id: 'ai-0', name: 'AI 左', isAi: true, difficulty: aiDifficulties['ai-0'] as 'easy' | 'medium' | 'hard', score: 0, isHuman: false },
      { id: 'ai-1', name: 'AI 上', isAi: true, difficulty: aiDifficulties['ai-1'] as 'easy' | 'medium' | 'hard', score: 0, isHuman: false },
      { id: 'ai-2', name: 'AI 右', isAi: true, difficulty: aiDifficulties['ai-2'] as 'easy' | 'medium' | 'hard', score: 0, isHuman: false },
    ];
    const state = createInitialState(players);
    setHumanId('human');
    setGameState(state);
    setMode('single');
  }, [playerName, aiDifficulties]);

  // ========== LAN: AI Turn Handling ==========

  useEffect(() => {
    if (mode !== 'lan' || !gameState || gameState.phase !== 'playing') return;
    if (showPassUI) setShowPassUI(false);
    if (gameState.trickJustCompleted) return;

    setWaitingForAi(true);

    aiTimeoutRef.current = setTimeout(() => {
      const latestState = gameStateRef.current;
      if (!latestState || latestState.phase !== 'playing') { setWaitingForAi(false); return; }
      const latestDecision = getAiPlayDecision(latestState);
      if (!latestDecision) { setWaitingForAi(false); return; }

      const newState = playCard(latestState, latestDecision.playerId, latestDecision.cardId);
      setGameState(newState);
      lanPeer.broadcast(newState);
      if (newState.phase === 'roundOver') setRoundOver(true);
      else if (newState.phase === 'gameOver') setGameOver(true);
      setWaitingForAi(false);
    }, latestDecision.delay ?? 500);

    return () => { if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current); };
  }, [gameState?.currentPlayerId, gameState?.phase, gameState?.trickJustCompleted, mode]);

  // ========== LAN: Handle Incoming Card Plays from Clients ==========

  useEffect(() => {
    if (mode !== 'lan' || !lanIsHost) return;

    const handleCardPlay = (data: any) => {
      const cardId = data.payload?.cardId || data.cardId;
      const senderId = data.from;
      if (!cardId || !senderId || !gameStateRef.current) return;

      const state = gameStateRef.current;
      // Guard: ignore plays during the 1-second trick-completion grace period
      if (state.trickJustCompleted) return;

      // Validate: reject illegal cards (don't follow suit, miss 2♣, etc.)
      const hand = state.hands.get(senderId) || [];
      const hb = heartsAreBroken(state.hands, state.highestHeart);
      const card = hand.find(c => c.id === cardId);
      if (!card || !canPlayCard(card, hand, state.currentTrick, hb)) return;

      const newState = playCard(state, senderId, cardId);
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

  // ========== Common: AI Turn (single mode only) ==========

  useEffect(() => {
    if (mode !== 'single') return;
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

  // ========== Unified Deal Animation Effect ==========

  useEffect(() => {
    if (!gameState || gameState.phase !== 'dealing') return;
    if (isDealingRef.current) return;

    isDealingRef.current = true;
    const state = gameStateRef.current;
    if (!state) return;

    const playerIds = state.players.map(p => p.id);
    const humanPlayerId = state.players.find(p => p.isHuman)?.id || playerIds[0];
    const humanIdx = playerIds.indexOf(humanPlayerId);
    if (humanIdx < 0) return;

    // Wait 400ms for shuffle feel, then deal cards one by one round-robin
    const t1 = setTimeout(() => {
      // Shuffle once
      const shuffled = [...state.deck];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setShuffledDeck(shuffled);

      // Clear previous deal count
      setDealCount(0);
      const initPerPlayer: Record<string, Card[]> = {};
      for (const pid of playerIds) {
        initPerPlayer[pid] = [];
      }
      dealPerPlayerRef.current = initPerPlayer;

      // Deal one card every 70ms round-robin
      let dealtIdx = 0;
      dealIntervalRef.current = setInterval(() => {
        if (dealtIdx >= shuffled.length) {
          clearInterval(dealIntervalRef.current!);
          dealIntervalRef.current = null;

          // All 52 cards dealt — build final hands from the same shuffled deck, sort, proceed
          const sortedHands = new Map<string, Card[]>();
          for (const pid of playerIds) {
            sortedHands.set(pid, sortHand(dealPerPlayerRef.current[pid]));
          }

          const finalState = buildDealState(state, sortedHands);

          setTimeout(() => {
            isDealingRef.current = false;
            setGameState(finalState);
            if (finalState.passedDirections[finalState.players[0].id] === 'none') {
              setGameState(applyCardPass(finalState));
            } else {
              setShowPassUI(true);
              setSelectedPassCardIds(new Set());
            }
            if (mode === 'lan') {
              // Broadcast the post-deal state (with hands) so clients can show their cards
              lanPeer.broadcast(finalState);
              // If there's a pass phase, broadcast the passed-card state too
              if (finalState.passedDirections[finalState.players[0].id] !== 'none') {
                lanPeer.broadcast(finalState);
              } else {
                // No pass: broadcast the playing state directly
                lanPeer.broadcast(applyCardPass(finalState));
              }
            }
          }, 500);
          return;
        }

        const card = shuffled[dealtIdx];
        const targetPlayer = playerIds[dealtIdx % playerIds.length];
        // Insert card in sorted order using immutable copy (new array each time)
        const arr = dealPerPlayerRef.current[targetPlayer];
        const newArr = [...arr];
        let insertAt = newArr.length;
        for (let i = 0; i < newArr.length; i++) {
          if (cardSort(card, newArr[i]) < 0) { insertAt = i; break; }
        }
        newArr.splice(insertAt, 0, card);
        dealPerPlayerRef.current = { ...dealPerPlayerRef.current, [targetPlayer]: newArr };

        // Trigger re-render on every card deal
        setDealCount(prev => prev + 1);

        dealtIdx++;
      }, 70);

      return () => {
        if (dealIntervalRef.current) {
          clearInterval(dealIntervalRef.current);
          dealIntervalRef.current = null;
        }
      };
    }, 400);

    return () => clearTimeout(t1);
  }, [gameState?.phase, mode]);

  // ========== Common: Card Click Handler ==========

  const handleCardClick = useCallback((card: Card) => {
    const state = gameStateRef.current;
    if (!state || state.phase !== 'playing') return;
    if (state.currentPlayerId !== humanId) return;
    if (waitingForAi) return;
    if (state.trickJustCompleted) return;

    const hand = state.hands.get(humanId) || [];
    const hb = heartsAreBroken(state.hands, state.highestHeart);
    if (!canPlayCard(card, hand, state.currentTrick, hb)) return;

    const newState = playCard(state, humanId, card.id);
    setGameState(newState);
    if (newState.phase === 'roundOver') setRoundOver(true);
    else if (newState.phase === 'gameOver') setGameOver(true);
  }, [humanId, waitingForAi]);

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
    // Broadcast to LAN clients if host
    if (mode === 'lan' && lanIsHostRef.current) {
      lanPeer.broadcast(newState);
    }
  }, [gameState, mode]);

  const handlePassConfirm = () => {
    if (!gameState || gameState.phase !== 'passing') return;

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
        const sent = lanPeer.sendToHost('pass-card', { cardIds: Array.from(selectedPassCardIds), type: 'pass-card' });
        if (sent) {
          setLanClientSentPass(true);
          // Keep selection visible until host broadcasts the new state
        } else {
          console.warn('[LAN-CLIENT] Failed to send pass-card to host');
          setLanErrorMessage('传牌发送失败，请重试');
        }
        return;
      }
    }

    // single: apply locally
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
  }, [gameState]);

  // ========== Menu Screen ==========

  if (!mode) {
    return (
      <Menu
        onStartSingle={startSingle}
        onStartLanHost={handleLanCreateRoom}
        onStartLanJoin={handleLanJoinRoom}
        theme={theme}
        onThemeChange={setTheme}
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
        onAddAi={handleAddAi}
        onCancel={handleLanLeave}
        status={lanStatus}
        errorMessage={lanErrorMessage}
        serverHost={lanPeer.serverConfig.host}
        theme={theme}
      />
    );
  }

  // ========== Loading States ==========

  if (!gameState) {
    return (
      <div className="min-h-screen min-h-dvh flex items-center justify-center"
        style={{ background: 'var(--bg-start, #0d5e28)' }}>
        <div className="text-white text-xl animate-pulse">游戏中...</div>
      </div>
    );
  }

  // ========== Playing Phase ==========

  // During deal animation, human hand is in deal order (not sorted), only show dealt cards
  const fullHumanHand = gameState!.hands.get(humanId) || [];
  let humanHand: Card[];
  if (isDealingRef.current && shuffledDeck.length > 0) {
    humanHand = [...(dealPerPlayerRef.current[humanId] || [])];
  } else {
    humanHand = fullHumanHand;
  }
  const playableIds = new Set(
    humanHand.length > 0
      ? getAllPlayableCards(humanHand, gameState!.currentTrick, heartsAreBroken(gameState!.hands, gameState!.highestHeart)).map(c => c.id)
      : []
  );

  // Responsive hand layout — scales with viewport
  // Hand area is capped by vh so landscape phones keep room for the table.
  // Cards wider than handMaxH are clipped by overflow:hidden below.
  const handMaxH = resp.vh < 400 ? '80px' : resp.vh < 500 ? '100px' : resp.vh < 650 ? '130px' : '160px';
  const topBarFontSize = resp.compactFactor < 0.2 ? '10px' : resp.compactFactor < 0.5 ? '11px' : undefined;

  // ── Passing phase helpers (same logic, integrated into game layout) ──

  const isPassingPhase = gameState.phase === 'passing';
  const passDir: PassDirection = isPassingPhase ? (gameState.passedDirections[humanId] ?? 'none') : 'none';
  const passLabel = passDir === 'left' ? '← 左侧玩家' : passDir === 'right' ? '→ 右侧玩家' : passDir === 'across' ? '↑ 对面玩家' : '无';
  const maxPass = isPassingPhase ? Math.min(3, Math.floor(humanHand.length / 4)) : 0;

  const togglePassCard = (cardId: string) => {
    if (!isPassingPhase) return;
    if (maxPass === 0) return;
    setSelectedPassCardIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        // 已选中则取消，始终允许
        newSet.delete(cardId);
        return newSet;
      }
      // 未满时才能新增
      if (newSet.size < maxPass) {
        newSet.add(cardId);
        return newSet;
      }
      // 已满，拒绝操作
      return prev;
    });
  };

  // Settlement: human player's scoring cards
  const isSettlement = roundOver || gameOver;
  const settlementCards = isSettlement ? gameState!.trickCardsWon : undefined;
  const humanScoringCards = isSettlement ? (settlementCards?.[humanId] || []).filter(c => c.suit === 'hearts' || (c.suit === 'spades' && c.rank === 12)) : [];

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative w-full h-full flex flex-col overflow-visible" style={{
      background: 'linear-gradient(180deg, var(--bg-start, #0d5e28) 0%, var(--bg-end, #094a20) 100%)',
    }}>
      {/* Top bar — menu button and round info */}
      <div className="flex items-center justify-between px-2 py-2 sm:px-4 sm:py-3 bg-black/0 shrink-0 relative z-50">
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            className="text-white/60 hover:text-white transition-colors"
            style={topBarFontSize ? { fontSize: topBarFontSize } : {}}
            onClick={() => setShowDropdown(!showDropdown)}
            aria-label="菜单选项"
          >
            ← 菜单
          </button>
          {showDropdown && (
            <div
              className="absolute top-full left-0 mt-1 rounded-xl shadow-menu py-2 z-50 min-w-[180px] overflow-hidden"
              style={{
                background: 'var(--menu-bg, #fff)',
                boxShadow: 'var(--shadow-menu, 0 4px 20px rgba(0,0,0,0.2))',
                border: '1px solid var(--menu-border, rgba(255,255,255,0.1))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* AI Difficulty Section */}
              <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--menu-text-muted, #9ca3af)' }}>AI 难度</div>
              {(['ai-0', 'ai-1', 'ai-2'] as const).map((aiId, idx) => {
                const aiNames = ['AI 左', 'AI 上', 'AI 右'];
                return (
                  <div key={aiId} className="px-3 py-1">
                    <div className="text-xs mb-0.5" style={{ color: 'var(--menu-text-secondary, #6b7280)' }}>{aiNames[idx]}</div>
                    <div className="flex gap-1">
                      {(['easy', 'medium', 'hard'] as const).map((diff) => {
                        const labels = { easy: '简单', medium: '中等', hard: '困难' };
                        const isActive = aiDifficulties[aiId] === diff;
                        return (
                          <button
                            key={diff}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAiDifficulties(prev => ({ ...prev, [aiId]: diff }));
                            }}
                            className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${
                              isActive
                                ? 'text-white'
                                : ''
                            }`}
                            style={{
                              background: isActive ? 'var(--accent, #2ecc71)' : 'var(--menu-hover, #f3f4f6)',
                              color: isActive ? '#fff' : 'var(--menu-text-secondary, #6b7280)',
                            }}
                          >
                            {labels[diff]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="my-1.5" style={{ borderTop: '1px solid var(--menu-border, #e5e7eb)' }} />
              {/* Theme Section */}
              <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--menu-text-muted, #9ca3af)' }}>风格</div>
              <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
                {([
                  ['classic', '🟢 经典'],
                  ['modern', '🌙 现代暗色'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); setTheme(key); setShowDropdown(false); }}
                    className="text-xs px-2 py-1.5 rounded-md transition-all font-medium"
                    style={{
                      background: theme === key ? 'var(--accent, #2ecc71)' : 'var(--menu-hover, rgba(0,0,0,0.05))',
                      color: theme === key ? '#fff' : 'var(--menu-text-secondary, #6b7280)',
                      border: theme === key ? '1px solid var(--accent, #2ecc71)' : '1px solid var(--menu-border, rgba(0,0,0,0.1))',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="my-1.5" style={{ borderTop: '1px solid var(--menu-border, #e5e7eb)' }} />
              {/* Home Button */}
              <button
                className="w-full text-left px-3 py-1.5 text-sm transition-colors"
                style={{ color: 'var(--menu-text-primary, #374151)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMode(null);
                  setShowDropdown(false);
                }}
              >
                返回主页
              </button>
            </div>
          )}
        </div>
        <div
          className="text-white/70 font-medium truncate px-1"
          style={topBarFontSize ? { fontSize: topBarFontSize } : {}}
          aria-live="polite"
        >
          {mode === 'lan' ? `LAN · ${lanRoomCode}` : isPassingPhase ? `第 ${gameState.roundNumber} 回合 — 传牌` : `第 ${gameState.roundNumber} 回合`}
        </div>
      </div>

      {/* Table area — unified arena with hand, overflow-visible allows AI hands to extend */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-visible">
        <div className="flex-1 flex items-center justify-center min-h-0" style={{ margin: '-2px' }}>
        <Table
          trick={gameState.currentTrick}
          currentPlayerId={gameState.currentPlayerId}
          humanPlayerId={humanId}
          players={gameState.players.map(p => ({
            id: p.id, name: p.name, score: gameState.scores[p.id] ?? 0, isAi: !!p.isAi,
          }))}
          // During deal animation, pass dealPerPlayerRef for face-down card display
          aiHands={isDealingRef.current ? new Map(Object.entries(dealPerPlayerRef.current)) : gameState!.hands}
          {...tableParams}
          turnStatus={
            isPassingPhase ? (
              <div className="text-center">
                <div className="text-white/90 font-bold text-sm">传牌阶段</div>
                <div className="text-white/60 text-xs">
                  向 <span className="text-yellow-300 font-semibold">{passLabel}</span> 选择 {maxPass} 张牌
                </div>
              </div>
            ) : gameState.phase === 'dealing' ? (
              null
            ) : gameState.currentPlayerId === humanId && !waitingForAi ? (
              <div className="animate-pulse font-semibold" style={{ color: 'var(--accent, #2ecc71)' }}>轮到你了！</div>
            ) : waitingForAi ? (
              <div className="text-white/50">AI 思考中...</div>
            ) : (
              <div className="text-white/40">
                {gameState.players.find(p => p.id === gameState.currentPlayerId)?.name || ''} 的回合
              </div>
            )
          }
          passConfirmAction={isPassingPhase ? (
            <button
              onClick={handlePassConfirm}
              disabled={selectedPassCardIds.size !== maxPass}
              className="font-bold rounded ml-1 px-1.5 py-0.5 text-[10px] align-middle flex-shrink-0 opacity-90 hover:opacity-100 disabled:opacity-40"
            >
              确认
            </button>
          ) : undefined}
          settlementCards={isSettlement ? gameState!.trickCardsWon : undefined}
        />
        </div>
      </div>

      {/* Bottom: human hand — offset from bottom edge to clear corner curves */}
      <div className="shrink-0 flex flex-col items-center w-full pt-2 px-0.5 sm:px-4 relative z-10" style={{ paddingBottom: '20px', marginTop: '8px' }}>

        {isPassingPhase ? (
          /* ── Passing Phase UI ── */
          <>
            {/* Hand — selectable cards */}
            <div
              className="flex items-end px-0.5 sm:px-2 overflow-visible"
              style={{
                maxHeight: handMaxH,
                gap: 0,
                justifyContent: 'flex-start',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
              role="list"
              aria-label="你的手牌（点击选择传递）"
            >
              {humanHand.map((card, idx) => {
                const isSelected = selectedPassCardIds.has(card.id);
                return (
                  <div
                    key={card.id}
                    style={{
                      marginLeft: idx === 0 ? 0 : handSafeGap.safeGap,
                      flexShrink: 0,
                      minWidth: 0,
                    }}
                    className="select-none cursor-pointer"
                    role="listitem"
                    onClick={() => togglePassCard(card.id)}
                  >
                    <CardComponent
                      card={card}
                      selected={isSelected}
                      elevated={isSelected}
                      animate={false}
                      small
                      minPx={cardMinPx}
                      ariaLabel={`${card.rank} of ${card.suit}（点击选择传递）`}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : isSettlement ? (
          /* ── Settlement Phase Hand — show scoring cards ── */
          <div
            className="flex items-end px-0.5 sm:px-2 overflow-hidden"
            style={{
              maxHeight: handMaxH,
              gap: 0,
              justifyContent: 'flex-start',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
            role="list"
            aria-label="你的得分牌"
          >
            {humanScoringCards.map((card, idx) => (
              <div
                key={card.id}
                className="transition-transform duration-150"
                style={{
                  animationDelay: `${idx * 0.06}s`,
                  marginLeft: idx === 0 ? 0 : handSafeGap.safeGap,
                  flexShrink: 0,
                  minWidth: 0,
                }}
                role="listitem"
              >
                <CardComponent
                  card={card}
                  animate={false}
                  small
                  minPx={cardMinPx}
                  ariaLabel={`${card.rank} of ${card.suit}`}
                />
              </div>
            ))}
          </div>
        ) : (
          /* ── Playing Phase Hand ── */
          <div
            className="flex items-end px-0.5 sm:px-2 overflow-hidden"
            style={{
              maxHeight: handMaxH,
              gap: 0,
              justifyContent: 'flex-start',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
            role="list"
            aria-label="你的手牌"
          >
            {humanHand.map((card, idx) => {
              const playable = playableIds.has(card.id);
              const isCurrentPlayer = gameState.currentPlayerId === humanId;
              return (
                <div
                  key={card.id}
                  className="transition-transform duration-150"
                  style={{
                    animationDelay: `${idx * 0.06}s`,
                    transform: !playable && isCurrentPlayer ? 'scale(0.92) brightness(0.7)' : undefined,
                    marginLeft: idx === 0 ? 0 : handSafeGap.safeGap,
                    flexShrink: 0,
                    minWidth: 0,
                  }}
                  role="listitem"
                >
                  <CardComponent
                    card={card}
                    onClick={() => {
                      if (isCurrentPlayer && playable) {
                        if (mode === 'lan') {
                          // Guard against playing during trick-completion grace period
                          if (gameStateRef.current?.trickJustCompleted) return;
                          lanPeer.sendToHost('play-card', { cardId: card.id, type: 'play-card' });
                        } else {
                          handleCardClick(card);
                        }
                      }
                    }}
                    disabled={!isCurrentPlayer || waitingForAi || (!playable && isCurrentPlayer)}
                    animate={false}
                    small
                    minPx={cardMinPx}
                    ariaLabel={`${card.rank} of ${card.suit}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settlement overlay — roundOver / gameOver */}
      {(roundOver || gameOver) && (() => {
        const allScores = gameState!.players.map(p => {
          const wonCards = gameState!.trickCardsWon?.[p.id] || [];
          const baseRoundScore = wonCards.filter(c => c.suit === 'hearts' || (c.suit === 'spades' && c.rank === 12)).reduce((sum, c) => sum + (c.suit === 'hearts' ? 1 : 13), 0);
          const sgr = isShotGunTheRose(gameState!.trickCardsWon);
          const roundScore = sgr.found ? (p.id === sgr.holderId ? 0 : 26) : baseRoundScore;
          return {
            id: p.id,
            name: p.name,
            roundScore,
            totalScore: gameState!.scores[p.id] ?? 0,
          };
        });
        const sorted = [...allScores].sort((a, b) => a.totalScore - b.totalScore);
        const isGameOver = gameOver;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative z-10 rounded-2xl w-full max-w-sm sm:max-w-md"
              style={{
                background: 'var(--bg-dark, #1a1a2e)',
                boxShadow: 'var(--shadow-table, 0 20px 60px rgba(0,0,0,0.5))',
              }}
              role="dialog"
              aria-label={isGameOver ? '游戏结束' : `第 ${gameState!.roundNumber} 回合结束`}
            >
              <h2 className="text-lg sm:text-xl font-bold text-white text-center mb-2 sm:mb-3">
                {isGameOver ? '游戏结束!' : `第 ${gameState!.roundNumber} 回合结束`}
              </h2>

              {/* Ranking table */}
              <div className="space-y-1.5 sm:space-y-2 px-2 sm:px-4 mb-3 sm:mb-4">
                {sorted.map((player, idx) => (
                  <div
                    key={player.id}
                    className="rounded-lg p-1.5 sm:p-2"
                    style={{
                      background: idx === 0 ? 'var(--score-win-bg, rgba(46,204,113,0.15))' : 'rgba(255,255,255,0.05)',
                      border: idx === 0 ? '1px solid var(--score-win-border, rgba(46,204,113,0.4))' : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-sm sm:text-base">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                      <span className="text-white flex-1 font-medium text-xs sm:text-sm truncate">{player.name}</span>
                      <span className={`font-bold text-xs sm:text-sm ${idx === 0 ? '' : 'text-white/70'}`}
                        style={idx === 0 ? { color: 'var(--score-win-text, #2ecc71)' } : undefined}>
                        {player.roundScore} 分
                      </span>
                      <span className="text-white/50 text-[10px] sm:text-xs">
                        总计 {player.totalScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {isGameOver && (
                <div className="text-center text-[10px] sm:text-xs text-white/40 mb-2 sm:mb-3">
                  累计总分 · 先到100分者败
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-1.5 sm:gap-2 px-2 sm:px-4 pb-3 sm:pb-4">
                {isGameOver ? (
                  <button
                    className="flex-1 rounded-xl font-semibold text-white py-2 sm:py-2.5 text-xs sm:text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--accent, #2ecc71), var(--accent-dark, #27ae60))' }}
                    onClick={handleRestart}
                  >
                    重新开始
                  </button>
                ) : (
                  <button
                    className="flex-1 rounded-xl font-semibold text-white/70 hover:text-white transition-all py-2 sm:py-2.5 text-xs sm:text-sm"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                    onClick={handleContinue}
                  >
                    下一回合
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </MotionConfig>
  );
}

export default App;
