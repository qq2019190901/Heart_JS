import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';

interface LanLobbyProps {
  roomId: string;
  playerName: string;
  isHost: boolean;
  players: { id: string; name: string; isAi: boolean }[];
  onReady?: () => void;
  onCancel: () => void;
  status: 'waiting' | 'ready' | 'connecting' | 'error';
  errorMessage?: string;
}

const LanLobby: React.FC<LanLobbyProps> = memo(({
  roomId,
  playerName,
  isHost,
  players,
  onReady,
  onCancel,
  status,
  errorMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [minDim, setMinDim] = useState(Math.min(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const handleResize = () => setMinDim(Math.min(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPhone = minDim < 450;
  const isTablet = minDim >= 450 && minDim < 768;

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const containerPadding = isPhone ? 'p-2' : isTablet ? 'p-3 sm:p-4' : 'p-4 sm:p-6';
  const containerMaxWidth = isPhone ? 'max-w-[95vw]' : 'max-w-md';
  const titleSize = isPhone ? 'text-base' : isTablet ? 'text-lg' : 'text-xl';
  const subtitleSize = isPhone ? 'text-[10px]' : isTablet ? 'text-xs' : 'text-sm';
  const labelSize = isPhone ? 'text-[9px]' : 'text-xs';
  const roomCodeSize = isPhone ? 'text-2xl' : 'text-3xl';
  const playerItemPadding = isCompact ? 'px-2 py-1' : 'px-3 py-2';
  const playerNameSize = isVeryCompact ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm';
  const metaSize = isVeryCompact ? 'text-[9px]' : 'text-xs';
  const btnPadding = isVeryCompact ? 'py-1.5' : isCompact ? 'py-2' : 'py-2.5';
  const btnFontSize = isVeryCompact ? 'text-[10px]' : isCompact ? 'text-xs' : 'text-sm';

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center p-2 sm:p-4"
      style={{ background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)' }}>
      <motion.div
        className={`w-full ${containerMaxWidth} mx-auto rounded-2xl ${containerPadding}`}
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        {/* Title */}
        <h2 className={`${titleSize} text-white font-bold text-center mb-0.5 sm:mb-1`}>
          {isHost ? '创建房间成功' : '加入房间'}
        </h2>
        <p className={`${subtitleSize} text-white/50 text-center mb-3 sm:mb-4 sm:mb-5`}>
          {isHost ? '等待其他玩家加入...' : status === 'connecting' ? '正在连接房主...' : '已加入房间'}
        </p>

        {/* Room Code (host only) */}
        {isHost && (
          <div className="mb-3 sm:mb-4 sm:mb-5">
            <label className={`${labelSize} text-white/60 block mb-1.5 sm:mb-2 text-center`}>房间号（分享给好友）</label>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <div
                className={`${roomCodeSize} font-mono font-bold text-yellow-300 tracking-[0.3em] px-4 sm:px-6 py-2 sm:py-3 rounded-xl`}
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                {roomId}
              </div>
              <button
                onClick={handleCopyRoomCode}
                className={`rounded-lg ${metaSize} text-white font-medium transition-all ${btnPadding} px-2 sm:px-3`}
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        )}

        {/* Player List */}
        <div className="mb-3 sm:mb-4 sm:mb-5">
          <label className={`${labelSize} text-white/60 block mb-1.5 sm:mb-2`}>玩家列表 ({players.length}/4)</label>
          <div className="space-y-1 sm:space-y-1.5">
            {players.map((p, idx) => (
              <motion.div
                key={p.id}
                className={`flex items-center gap-2 sm:gap-3 rounded-lg ${playerItemPadding}`}
                style={{ background: 'rgba(255,255,255,0.05)' }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <span className={`${metaSize} text-white/40 w-3 sm:w-4`}>{idx + 1}</span>
                <span className={`text-white flex-1 truncate ${playerNameSize}`}>{p.name}</span>
                {p.isAi ? (
                  <span className={metaSize}>AI</span>
                ) : (
                  <span className="text-green-400">&#9679;</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status */}
        {status === 'connecting' && (
          <div className="text-center mb-3 sm:mb-4">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 text-yellow-300">
              <motion.span
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-300"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className={btnFontSize}>连接中...</span>
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="text-center mb-3 sm:mb-4">
            <div className={`text-red-400 ${btnFontSize}`}>{errorMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5 sm:gap-2">
          {isHost && onReady && (
            <button
              onClick={onReady}
              disabled={status === 'connecting' || players.length < 2}
              className={`flex-1 rounded-lg font-semibold transition-all ${btnPadding} ${btnFontSize}`}
              style={{
                background: status !== 'connecting' && players.length >= 2
                  ? 'linear-gradient(135deg, #2ecc71, #27ae60)'
                  : 'rgba(255,255,255,0.1)',
                color: status !== 'connecting' && players.length >= 2 ? 'white' : 'rgba(255,255,255,0.4)',
              }}
            >
              {players.length >= 2 ? '开始游戏' : `等待加入 (${players.length}/4)`}
            </button>
          )}
          {!isHost && (
            <div className={`flex-1 rounded-lg font-semibold text-center ${btnPadding} ${btnFontSize}`}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              等待房主开始游戏
            </div>
          )}
          <button
            onClick={onCancel}
            className={`flex-1 rounded-lg font-semibold transition-all ${btnPadding} ${btnFontSize}`}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            取消
          </button>
        </div>
      </motion.div>
    </div>
  );
});

LanLobby.displayName = 'LanLobby';

export { LanLobby };
