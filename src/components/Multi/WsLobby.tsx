import React, { useState, memo } from 'react';
import { wsManager } from '../../multiplayer/websocket';

interface WsLobbyProps {
  roomId: string;
  playerName: string;
  players: { id: string; name: string; ready: boolean }[];
  onCancel: () => void;
  onReadyUp: () => void;
  isHost: boolean;
}

const WsLobby: React.FC<WsLobbyProps> = memo(({
  roomId,
  playerName,
  players,
  onCancel,
  onReadyUp,
  isHost,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const localPlayerReady = players.find(p => p.name === playerName)?.ready ?? false;
  const allReady = players.length > 0 && players.every(p => p.ready);

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)' }}>
      <div
        className="w-full max-w-md mx-4 rounded-2xl p-6"
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Title */}
        <h2 className="text-white text-xl font-bold text-center mb-1">
          {isHost ? '创建房间成功' : '加入房间'}
        </h2>
        <p className="text-white/50 text-sm text-center mb-5">
          {isHost ? '等待其他玩家加入...' : '已加入房间'}
        </p>

        {/* Room Code */}
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

        {/* Player List */}
        <div className="mb-5">
          <label className="text-white/60 text-xs block mb-2">玩家列表 ({players.length}/4)</label>
          <div className="space-y-1.5">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className="text-white/40 text-xs w-4">{idx + 1}</span>
                <span className="text-white text-sm flex-1 truncate">
                  {p.name}{p.id === players[0]?.id && isHost ? ' (房主)' : ''}
                </span>
                {p.ready ? (
                  <span className="text-green-400 text-xs">已准备</span>
                ) : (
                  <span className="text-white/30 text-xs">未准备</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status hint */}
        {players.length < 4 && !allReady && (
          <div className="text-center mb-4">
            <div className="text-white/40 text-xs">
              {allReady ? '所有人已准备，等待房主开始...' : `需要更多玩家 (${players.length}/4)`}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onReadyUp}
            disabled={localPlayerReady}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all"
            style={{
              background: localPlayerReady
                ? 'rgba(255,255,255,0.1)'
                : isHost
                  ? 'linear-gradient(135deg, #2ecc71, #27ae60)'
                  : 'linear-gradient(135deg, #3498db, #2980b9)',
              color: localPlayerReady ? 'rgba(255,255,255,0.4)' : 'white',
            }}
          >
            {localPlayerReady ? '已准备' : isHost ? '准备并开始' : '准备'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            离开
          </button>
        </div>
      </div>
    </div>
  );
});

WsLobby.displayName = 'WsLobby';

export { WsLobby };
