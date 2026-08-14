import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';

interface LanLobbyProps {
  roomId: string;
  playerName: string;
  isHost: boolean;
  players: { id: string; name: string; isAi: boolean }[];
  onReady?: () => void;
  onAddAi?: () => void;
  onCancel: () => void;
  status: 'waiting' | 'ready' | 'connecting' | 'error';
  errorMessage?: string;
  serverHost?: string;
  theme?: 'classic' | 'modern';
}

const LanLobby: React.FC<LanLobbyProps> = memo(({
  roomId,
  playerName,
  isHost,
  players,
  onReady,
  onAddAi,
  onCancel,
  status,
  errorMessage,
  serverHost,
}) => {
  const [copied, setCopied] = useState(false);
  const [minDim, setMinDim] = useState(Math.min(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const handleResize = () => setMinDim(Math.min(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isPhone = minDim < 450;
  const isTablet = minDim >= 450 && minDim < 768;

  const containerPadding = isPhone ? 'p-3' : isTablet ? 'p-4' : 'p-5';
  const containerMaxWidth = isPhone ? 'max-w-[95vw]' : 'max-w-md';
  const titleSize = isPhone ? 'text-base' : 'text-lg';
  const subtitleSize = isPhone ? 'text-[10px]' : 'text-xs';
  const labelSize = isPhone ? 'text-[9px]' : 'text-xs';
  const roomCodeSize = isPhone ? 'text-2xl' : 'text-3xl';
  const playerItemPadding = isPhone ? 'px-2 py-1.5' : 'px-3 py-2';
  const metaSize = isPhone ? 'text-[9px]' : 'text-xs';

  // Player slots: up to 4 positions
  const slots = Array.from({ length: 4 }, (_, i) => {
    const p = players[i];
    const isHuman = !p || p.name === playerName;
    return p
      ? { id: p.id, name: p.name, isAi: p.isAi, occupied: true }
      : { id: `slot-${i}`, name: '', isAi: false, occupied: false };
  });

  const aiCount = players.filter(p => p.isAi).length;
  const canStart = players.length >= 2 && (status !== 'connecting');

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--menu-screen-bg, linear-gradient(160deg, #0a0a0f 0%, #12121c 40%, #1a1a2e 100%))' }}>

      {/* Ambient glows */}
      <div className="absolute top-[5%] right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none select-none"
        style={{ background: 'radial-gradient(circle, var(--menu-glow-3, rgba(59,130,246,0.1)) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[10%] left-[5%] w-[150px] h-[150px] rounded-full pointer-events-none select-none"
        style={{ background: 'radial-gradient(circle, var(--menu-glow-1, rgba(139,92,246,0.08)) 0%, transparent 70%)' }} />

      <motion.div
        className={`w-full ${containerMaxWidth} mx-auto rounded-2xl ${containerPadding}`}
        style={{
          background: 'var(--menu-panel-bg, linear-gradient(135deg, rgba(18,18,30,0.95) 0%, rgba(26,26,46,0.95) 100%))',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--menu-panel-border, rgba(139,92,246,0.2))',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        {/* Header */}
        <div className="text-center mb-4 sm:mb-5">
          <motion.div
            className="flex justify-center mb-2"
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.4))' }}
          >
            <span className="text-2xl sm:text-3xl">🌐</span>
          </motion.div>
          <h2 className={`${titleSize} text-white font-bold`}>
            {isHost ? '房间已创建' : '加入房间'}
          </h2>
          <p className={`${subtitleSize} text-white/40 mt-1`}>
            {isHost ? '分享房间号邀请好友加入' : '等待房主开始游戏...'}
          </p>
        </div>

        {/* Room Code (host only) */}
        {isHost && (
          <div className="mb-4 sm:mb-5">
            <label className={`${labelSize} text-white/50 block mb-2 text-center`}>房间号</label>
            <div className="flex items-center justify-center gap-2">
              <div
                className={`${roomCodeSize} font-mono font-bold tracking-[0.2em] px-4 sm:px-6 py-2.5 rounded-xl`}
                style={{
                  background: 'var(--menu-input-bg, rgba(0,0,0,0.4))',
                  border: '1px solid var(--menu-panel-border, rgba(139,92,246,0.3))',
                  color: '#fbbf24',
                  textShadow: '0 0 20px rgba(251,191,36,0.3)',
                }}
              >
                {roomId}
              </div>
              <button
                onClick={handleCopyRoomCode}
                className="nodrag rounded-lg text-sm font-medium transition-all py-1.5 px-3 hover:bg-white/10"
                style={{ background: 'var(--menu-hover, rgba(139,92,246,0.2))', color: 'var(--menu-text-secondary, rgba(167,139,250,0.9))' }}
              >
                {copied ? '✓ 已复制' : '复制'}
              </button>
            </div>
            {serverHost && (
              <p className={`text-white/30 text-center mt-1.5 ${isPhone ? 'text-[8px]' : 'text-[10px]'}`}>
                连接地址：{serverHost}:9000
              </p>
            )}
          </div>
        )}

        {/* Player Slots */}
        <div className="mb-4 sm:mb-5">
          <label className={`${labelSize} text-white/50 block mb-2`}>玩家 ({players.length}/4)</label>
          <div className="space-y-1.5">
            {slots.map((slot, idx) => (
              <motion.div
                key={slot.id}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2"
                style={{
                  background: slot.occupied
                    ? 'var(--score-win-bg, rgba(139,92,246,0.1))'
                    : 'var(--menu-input-bg, rgba(255,255,255,0.03))',
                  border: slot.occupied
                    ? '1px solid var(--menu-panel-border, rgba(139,92,246,0.2))'
                    : '1px dashed var(--menu-input-border, rgba(255,255,255,0.1))',
                }}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.08 }}
              >
                <span className={`${metaSize} text-white/30 w-4`}>{idx + 1}</span>
                {slot.occupied ? (
                  <>
                    <span className={`text-white flex-1 truncate font-medium ${isPhone ? 'text-[11px]' : 'text-xs'}`}>
                      {slot.name}
                    </span>
                    {slot.isAi ? (
                      <span className={`${metaSize} text-purple-400/70`}>AI</span>
                    ) : (
                      <span className="text-green-400 text-[10px]">●</span>
                    )}
                  </>
                ) : (
                  <span className={`text-white/20 flex-1 ${isPhone ? 'text-[10px]' : 'text-xs'}`}>空位</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status */}
        {status === 'connecting' && (
          <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-yellow-400"
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className={`text-yellow-400 ${isPhone ? 'text-[10px]' : 'text-xs'}`}>连接中...</span>
          </div>
        )}
        {status === 'error' && errorMessage && (
          <div className="text-center mb-3 sm:mb-4">
            <span className={`text-red-400 ${isPhone ? 'text-[10px]' : 'text-xs'}`}>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-1.5">
          {isHost && onReady && (
            <>
              {aiCount < 3 && (
                <button
                  onClick={onAddAi}
                  className="nodrag w-full rounded-lg font-medium transition-all py-2 text-xs sm:text-sm"
                  style={{
                    background: 'var(--menu-hover, rgba(59,130,246,0.15))',
                    border: '1px solid var(--menu-panel-border, rgba(59,130,246,0.3))',
                    color: 'var(--menu-text-secondary, rgba(147,197,253,0.9))',
                  }}
                >
                  + 添加 AI 对手 ({3 - aiCount} 个空缺)
                </button>
              )}
              <button
                onClick={onReady}
                disabled={!canStart}
                className="nodrag w-full rounded-lg font-semibold transition-all py-2 text-xs sm:text-sm"
                style={{
                  background: canStart
                    ? 'linear-gradient(135deg, var(--accent, #2ecc71), var(--accent-dark, #27ae60))'
                    : 'var(--menu-input-bg, rgba(255,255,255,0.08))',
                  boxShadow: canStart ? '0 2px 12px var(--accent-glow, rgba(46,204,113,0.25))' : 'none',
                  color: canStart ? '#fff' : 'var(--menu-text-muted, rgba(255,255,255,0.3))',
                }}
              >
                {players.length >= 2 ? '开始游戏' : `等待加入 (${players.length}/4)`}
              </button>
            </>
          )}
          {!isHost && (
            <div className={`w-full rounded-lg font-medium text-center py-2 text-xs sm:text-sm`}
              style={{ background: 'var(--menu-input-bg, rgba(255,255,255,0.05))', color: 'var(--menu-text-muted, rgba(255,255,255,0.4))' }}>
              等待房主开始游戏
            </div>
          )}
          <button
            onClick={onCancel}
            className="nodrag w-full rounded-lg font-medium transition-all py-2 text-xs sm:text-sm"
            style={{
              background: 'var(--menu-input-bg, rgba(255,255,255,0.06))',
              border: '1px solid var(--menu-input-border, rgba(255,255,255,0.1))',
              color: 'var(--menu-text-muted, rgba(255,255,255,0.5))',
            }}
          >
            返回
          </button>
        </div>
      </motion.div>
    </div>
  );
});

LanLobby.displayName = 'LanLobby';

export { LanLobby };
