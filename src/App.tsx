import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Menu } from './components/Menu/Menu';
import { CardComponent } from './components/Card/Card';
import { Table } from './components/Table/Table';
import { ScoreBoard } from './components/ScoreBoard/ScoreBoard';
import type { GameState, Card, Player, PassDirection } from './game/types';
import { createInitialState, dealCardsForRound, applyCardPass, playCard } from './game/hearts-game';
import { getAiDecision } from './game/ai';
import { heartsAreBroken, canPlayCard, getAllPlayableCards } from './game/rules';
import { wsManager } from './multiplayer/websocket';
import { useBreakpoint } from './hooks/useBreakpoint';

type GameMode = 'single' | 'local' | 'multi';

function App() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [humanId, setHumanId] = useState('');
  const [roundOver, setRoundOver] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [playerName] = useState('玩家');
  const [waitingForAi, setWaitingForAi] = useState(false);
  const [multiStatus, setMultiStatus] = useState<'idle' | 'connecting' | 'connected' | 'in_room'>('idle');
  const [showPassUI, setShowPassUI] = useState(false);
  const [selectedPassCardIds, setSelectedPassCardIds] = useState<Set<string>>(new Set());
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const isMobile = useBreakpoint(768);

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
      // Show passing UI for single-player too
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

  // Deserialize server-sent gameState: hands is a plain object, convert to Map
  const deserializeState = useCallback((raw: any): GameState | null => {
    if (!raw) return null;
    const handsRaw = raw.hands;
    const hands = new Map<string, Card[]>();
    if (handsRaw && typeof handsRaw === 'object') {
      for (const [k, v] of Object.entries(handsRaw)) {
        if (Array.isArray(v)) hands.set(k, v);
      }
    }
    return {
      ...raw,
      hands,
    } as GameState;
  }, []);

  useEffect(() => {
    wsManager.on('room_created', (data) => {
      wsManager.setRoomId(data.roomId);
      setMultiStatus('in_room');
    });
    wsManager.on('room_joined', () => {
      setMultiStatus('in_room');
    });
    wsManager.on('start_game', (data) => {
      const state = deserializeState(data.state);
      setGameState(state);
      setHumanId(state?.players.find((p: Player) => p.isHuman)?.id ?? '');
      setMultiStatus('in_room');
      // If in passing phase for multiplayer, enable pass UI
      if (state?.phase === 'passing') {
        setShowPassUI(true);
      }
    });
    wsManager.on('game_state', (data) => {
      const state = deserializeState(data.state);
      setGameState(state);
      if (state?.phase === 'passing') {
        setShowPassUI(true);
      } else if (state?.phase === 'playing') {
        setShowPassUI(false);
        setSelectedPassCardIds(new Set());
      }
      if (state?.phase === 'roundOver') setRoundOver(true);
      else if (state?.phase === 'gameOver') setGameOver(true);
    });
    wsManager.on('round_over', () => {
      setRoundOver(true);
    });
    wsManager.on('game_over', () => {
      setGameOver(true);
    });

    return () => {
      wsManager.disconnect();
    };
  }, []);

  // Keep gameStateRef always up to date
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (showPassUI) setShowPassUI(false);

    // If a trick just completed, don't start new AI turns yet
    if (gameState.trickJustCompleted) return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayerId);
    if (!currentPlayer) return;
    if (!currentPlayer.isAi) return;

    const hand = gameState.hands.get(currentPlayer.id) || [];
    const hb = heartsAreBroken(gameState.hands);
    const difficulty = (currentPlayer as unknown as Record<string, unknown>).difficulty as 'easy' | 'medium' | 'hard' || 'medium';
    const decision = getAiDecision(currentPlayer, hand, gameState.currentTrick, hb, difficulty);

    console.log('[AI-EFFECT] AI turn triggered:', {
      currentPlayerId: gameState.currentPlayerId,
      playerName: currentPlayer.name,
      handSize: hand.length,
      trickCards: gameState.currentTrick?.cards.length ?? 0,
      trickJustCompleted: gameState.trickJustCompleted,
      waitingForAi,
      delay: decision.delay,
    });

    setWaitingForAi(true);

    aiTimeoutRef.current = setTimeout(() => {
      // Read latest state from ref, not stale closure
      const latestState = gameStateRef.current;
      if (!latestState || latestState.phase !== 'playing') {
        console.log('[AI-TIMEOUT] SKIPPED: phase not playing', latestState?.phase);
        setWaitingForAi(false);
        return;
      }
      const latestPlayer = latestState.players.find(p => p.id === latestState.currentPlayerId);
      if (!latestPlayer || latestPlayer.isHuman) {
        console.log('[AI-TIMEOUT] SKIPPED: not AI or human turn', {
          currentPlayerId: latestState.currentPlayerId,
          isHuman: latestPlayer?.isHuman,
          found: !!latestPlayer,
        });
        setWaitingForAi(false);
        return;
      }
      const latestHand = latestState.hands.get(latestPlayer.id) || [];
      const latestHb = heartsAreBroken(latestState.hands);
      const latestDecision = getAiDecision(latestPlayer, latestHand, latestState.currentTrick, latestHb, difficulty);

      console.log('[AI-TIMEOUT] Decision:', {
        playerId: latestPlayer.id,
        playerName: latestPlayer.name,
        handSize: latestHand.length,
        cardIds: latestDecision.cardIds,
        delay: latestDecision.delay,
        trickCards: latestState.currentTrick?.cards.length ?? 0,
        currentPlayerId: latestState.currentPlayerId,
      });

      if (latestDecision.cardIds.length > 0) {
        const newState = playCard(latestState, latestPlayer.id, latestDecision.cardIds[0]);
        console.log('[AI-TIMEOUT] playCard result:', {
          from: latestPlayer.id,
          to: newState.currentPlayerId,
          trickCards: newState.currentTrick?.cards.length ?? 0,
          trickJustCompleted: newState.trickJustCompleted,
          phase: newState.phase,
        });
        setGameState(newState);
        if (newState.phase === 'roundOver') setRoundOver(true);
        else if (newState.phase === 'gameOver') setGameOver(true);
      } else {
        console.log('[AI-TIMEOUT] No playable card found!');
      }
      setWaitingForAi(false);
    }, decision.delay);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [gameState?.currentPlayerId, gameState?.phase, gameState?.trickJustCompleted, humanId]);

  // After a trick completes, show all 4 cards for 1 second before clearing
  useEffect(() => {
    if (!gameState || !gameState.trickJustCompleted) return;
    console.log('[TRICK] Completed, showing for 1s, trick cards:', gameState.currentTrick?.cards.length);
    // Prevent any pending AI timeouts from interfering
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    trickTimerRef.current = setTimeout(() => {
      console.log('[TRICK] Clearing trick after 1s');
      setGameState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          trickJustCompleted: false,
          currentTrick: null,
        };
      });
    }, 1000);
    return () => {
      if (trickTimerRef.current) clearTimeout(trickTimerRef.current);
    };
  }, [gameState?.trickJustCompleted]);

  const handleCardClick = useCallback((card: Card) => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentPlayerId !== humanId) return;
    if (waitingForAi) return;
    // Block play during trick completion pause
    if (gameState.trickJustCompleted) return;

    const hand = gameState.hands.get(humanId) || [];
    const hb = heartsAreBroken(gameState.hands);
    if (!canPlayCard(card, hand, gameState.currentTrick, hb)) {
      console.log('[HUMAN] Card rejected:', { cardId: card.id, reason: 'invalid play' });
      return;
    }

    console.log('[HUMAN] Playing card:', { cardId: card.id, trickBefore: gameState.currentTrick?.cards.length ?? 0 });
    const newState = playCard(gameState, humanId, card.id);
    console.log('[HUMAN] playCard result:', {
      from: humanId,
      to: newState.currentPlayerId,
      trickCards: newState.currentTrick?.cards.length ?? 0,
      trickJustCompleted: newState.trickJustCompleted,
      phase: newState.phase,
    });
    setGameState(newState);
    if (newState.phase === 'roundOver') setRoundOver(true);
    else if (newState.phase === 'gameOver') setGameOver(true);
  }, [gameState, humanId, waitingForAi]);

  const handleContinue = useCallback(() => {
    if (!gameState) return;
    const nextRound = gameState.roundNumber + 1;
    const newState = createInitialState(gameState.players, nextRound);
    // Preserve cumulative scores across rounds
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
      // Always show passing UI for all modes
      if (dealt.phase === 'passing') {
        setShowPassUI(true);
        setSelectedPassCardIds(new Set());
      }
    }, 500);
  }, [gameState, mode]);

  const handlePassConfirm = () => {
    if (!gameState || gameState.phase !== 'passing') return;
    setShowPassUI(false);

    if (mode === 'multi') {
      // Multiplayer: send selected cards to server
      const cardIds = Array.from(selectedPassCardIds);
      wsManager.passCard(cardIds);
      // Don't clear state yet, server will respond with updated state
      return;
    }
    // Local/single: apply locally with user's selected cards
    const prevSelection = new Set(selectedPassCardIds);
    setSelectedPassCardIds(new Set());
    const humanHand = gameState.hands.get(humanId) || [];
    const selectedCards = humanHand.filter(c => prevSelection.has(c.id));

    // Replace human's passed cards with user selection, keep AI's as-is
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
  }, [gameState, mode]);

  if (!mode) {
    return <Menu onStartSingle={startSingle} onStartMulti={startMulti} onStartLocal={startLocal} />;
  }

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

  if (!gameState) {
    return (
      <div className="min-h-screen min-h-dvh bg-emerald-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">游戏中...</div>
      </div>
    );
  }

  // Dealing phase - show loading
  if (gameState.phase === 'dealing') {
    return (
      <div className="min-h-screen min-h-dvh bg-emerald-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">发牌中...</div>
      </div>
    );
  }

  // Passing phase UI
  if (gameState.phase === 'passing') {
    const humanHand = gameState.hands.get(humanId) || [];
    const maxPass = Math.min(3, Math.floor(humanHand.length / 4));

    const togglePassCard = (cardId: string) => {
      setSelectedPassCardIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(cardId)) {
          newSet.delete(cardId);
        } else if (newSet.size < maxPass) {
          newSet.add(cardId);
        }
        return newSet;
      });
    };

    const passDir: PassDirection = gameState.passedDirections[humanId] ?? 'none';
    const passLabel = passDir === 'left' ? '← 左侧玩家' : passDir === 'right' ? '→ 右侧玩家' : passDir === 'across' ? '↑ 对面玩家' : '无';
    const selectedArr = humanHand.filter(c => selectedPassCardIds.has(c.id));

    return (
      <div className="min-h-screen min-h-dvh flex flex-col overflow-hidden" style={{
        background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)',
      }}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/20 shrink-0">
          <button
            className="text-white/60 text-sm hover:text-white transition-colors"
            onClick={() => setMode(null)}
          >
            ← 菜单
          </button>
          <div className="text-white/50 text-xs font-medium">
            第 {gameState.roundNumber} 回合 — 传牌阶段
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 min-h-0">
          <div className="text-center">
            <h2 className="text-white text-lg sm:text-2xl font-bold mb-1">传牌阶段</h2>
            <p className="text-white/70 text-xs sm:text-sm">
              向 <span className="text-yellow-300 font-semibold">{passLabel}</span> 选择 {Math.min(3, Math.floor(humanHand.length / 4))} 张牌
            </p>
          </div>

          {/* Selected cards to pass */}
          {selectedArr.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {selectedArr.map((card) => (
                <div
                  key={card.id}
                  className="relative cursor-pointer"
                  onClick={() => togglePassCard(card.id)}
                >
                  <CardComponent card={card} small />
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md">
                    ✕
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/50 text-sm italic">请选择要传递的牌</div>
          )}

          {/* Human hand - clickable for passing */}
          <div className="w-full max-w-lg">
            <div className="text-white/50 text-xs text-center mb-2">你的手牌（点击选择）</div>
            <div className="flex items-end justify-center gap-0.5 flex-wrap" style={{ maxHeight: 'clamp(120px, 40dvh, 250px)' }}>
              {humanHand.map((card, idx) => {
                const isSelected = selectedPassCardIds.has(card.id);
                return (
                  <div
                    key={card.id}
                    className={`transition-all duration-200 ${isSelected ? 'opacity-50' : ''}`}
                    style={{
                      transform: isSelected ? 'scale(0.9)' : undefined,
                      marginLeft: idx > 0 ? -8 : 0,
                      cursor: isSelected || selectedPassCardIds.size < maxPass ? 'pointer' : 'default',
                    }}
                    onClick={() => togglePassCard(card.id)}
                  >
                    <CardComponent card={card} small />
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handlePassConfirm}
            disabled={selectedPassCardIds.size !== maxPass}
            className={`px-6 py-2.5 font-bold rounded-lg transition-colors text-sm sm:text-base shadow-lg ${
              selectedPassCardIds.size === maxPass
                ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            确认传递 ✓
          </button>
        </div>
      </div>
    );
  }

  const humanHand = gameState.hands.get(humanId) || [];
  const playableIds = new Set(
    getAllPlayableCards(humanHand, gameState.currentTrick, heartsAreBroken(gameState.hands)).map(c => c.id)
  );

  return (
    <div className="relative w-full h-full flex flex-col" style={{
      background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)',
    }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/20 shrink-0">
        <button
          className="text-white/60 text-sm hover:text-white transition-colors"
          onClick={() => setMode(null)}
        >
          ← 菜单
        </button>
        <div className="text-white/70 text-sm font-medium">
          第 {gameState.roundNumber} 回合
        </div>
      </div>

      {/* Table area — fills all available space */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden">
        <Table
          trick={gameState.currentTrick}
          currentPlayerId={gameState.currentPlayerId}
          humanPlayerId={humanId}
          players={gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            score: gameState.scores[p.id] ?? 0,
            isAi: !!p.isAi,
          }))}
          aiHands={gameState.hands}
        />
      </div>

      {/* Bottom bar: turn indicator + hand */}
      <div className="shrink-0 flex flex-col items-center px-2 sm:px-4 pb-3 pt-2">
        {/* Turn indicator */}
        <div className="h-6 flex items-center justify-center shrink-0 w-full mb-1">
          {gameState.currentPlayerId === humanId && !waitingForAi && (
            <div className="text-green-300 text-sm animate-pulse font-semibold">
              轮到你了！
            </div>
          )}
          {waitingForAi && (
            <div className="text-white/50 text-sm">AI 思考中...</div>
          )}
          {!waitingForAi && gameState.currentPlayerId !== humanId && (
            <div className="text-white/40 text-sm">
              {gameState.players.find(p => p.id === gameState.currentPlayerId)?.name || ''} 的回合
            </div>
          )}
        </div>

        {/* Human hand */}
        <div className="flex items-center justify-center flex-wrap gap-1 px-1 sm:px-2"
          style={{ maxHeight: isMobile ? '160px' : '200px' }}>
          {humanHand.map((card) => {
            const playable = playableIds.has(card.id);
            const isCurrentPlayer = gameState.currentPlayerId === humanId;
            return (
              <div
                key={card.id}
                className="transition-transform duration-150"
                style={{
                  marginLeft: isMobile ? '-12px' : undefined,
                  transform: !playable && isCurrentPlayer ? 'scale(0.92) brightness(0.7)' : undefined,
                }}
              >
                <CardComponent
                  card={card}
                  onClick={() => {
                    if (isCurrentPlayer && playable) {
                      if (mode === 'multi') {
                        wsManager.playCard(card.id);
                      } else {
                        handleCardClick(card);
                      }
                    }
                  }}
                  disabled={!isCurrentPlayer || waitingForAi || (!playable && isCurrentPlayer)}
                  animate={false}
                  small={isMobile}
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
