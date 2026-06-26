import React, { useState, memo } from 'react';
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

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)' }}>
      <motion.div
        className="w-full max-w-md mx-4 rounded-2xl p-6"
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
        <h2 className="text-white text-xl font-bold text-center mb-1">
          {isHost ? '创建房间成功' : '加入房间'}
        </h2>
        <p className="text-white/50 text-sm text-center mb-5">
          {isHost ? '等待其他玩家加入...' : status === 'connecting' ? '正在连接房主...' : '已加入房间'}
        </p>

        {/* Room Code (host only) */}
        {isHost && (
          <div className="mb-5">
            <label className="text-white/60 text-xs block mb-2 text-center">房间号（分享给好友）</label>
            <div className="flex items-center justify-center gap-2">
              <div
                className="text-3xl font-mono font-bold text-yellow-300 tracking-[0.3em] px-6 py-3 rounded-xl"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                {roomId}
              </div>
              <button
                onClick={handleCopyRoomCode}
                className="px-3 py-2 rounded-lg text-xs text-white font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
        )}

        {/* Player List */}
        <div className="mb-5">
          <label className="text-white/60 text-xs block mb-2">玩家列表 ({players.length}/4)</label>
          <div className="space-y-1.5">
            {players.map((p, idx) => (
              <motion.div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <span className="text-white/40 text-xs w-4">{idx + 1}</span>
                <span className="text-white text-sm flex-1 truncate">{p.name}</span>
                {p.isAi ? (
                  <span className="text-white/30 text-xs">AI</span>
                ) : (
                  <span className="text-green-400 text-xs">●</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Status */}
        {status === 'connecting' && (
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 text-yellow-300 text-sm">
              <motion.span
                className="w-2 h-2 rounded-full bg-yellow-300"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              连接中...
            </div>
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="text-center mb-4">
            <div className="text-red-400 text-sm">{errorMessage}</div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {isHost && onReady && (
            <button
              onClick={onReady}
              disabled={status === 'connecting' || players.length < 2}
              className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all"
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
            <div className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-center"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              等待房主开始游戏
            </div>
          )}
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all"
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
