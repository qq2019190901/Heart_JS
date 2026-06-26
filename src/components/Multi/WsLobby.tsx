import React, { useState, useEffect, memo } from 'react';
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
  const [minDim, setMinDim] = useState(Math.min(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const handleResize = () => setMinDim(Math.min(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isCompact = minDim < 500;
  const isVeryCompact = minDim < 400;

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const localPlayerReady = players.find(p => p.name === playerName)?.ready ?? false;
  const allReady = players.length > 0 && players.every(p => p.ready);

  const containerPadding = isVeryCompact ? 'p-2' : isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-6';
  const containerMaxWidth = isVeryCompact ? 'max-w-[95vw]' : 'max-w-md';
  const titleSize = isVeryCompact ? 'text-base' : isCompact ? 'text-lg' : 'text-xl';
  const subtitleSize = isVeryCompact ? 'text-[10px]' : isCompact ? 'text-xs' : 'text-sm';
  const labelSize = isVeryCompact ? 'text-[9px]' : 'text-xs';
  const roomCodeSize = isVeryCompact ? 'text-2xl' : 'text-3xl';
  const playerItemPadding = isCompact ? 'px-2 py-1' : 'px-3 py-2';
  const playerNameSize = isVeryCompact ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm';
  const metaSize = isVeryCompact ? 'text-[9px]' : 'text-xs';
  const btnPadding = isVeryCompact ? 'py-1.5' : isCompact ? 'py-2' : 'py-2.5';
  const btnFontSize = isVeryCompact ? 'text-[10px]' : isCompact ? 'text-xs' : 'text-sm';
  const hintSize = isVeryCompact ? 'text-[9px]' : isCompact ? 'text-[10px]' : 'text-xs';

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center p-2 sm:p-4"
      style={{ background: 'linear-gradient(180deg, #0d5e28 0%, #094a20 100%)' }}>
      <div
        className={`w-full ${containerMaxWidth} mx-auto rounded-2xl ${containerPadding}`}
        style={{
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Title */}
        <h2 className={`${titleSize} text-white font-bold text-center mb-0.5 sm:mb-1`}>
          {isHost ? '创建房间成功' : '加入房间'}
        </h2>
        <p className={`${subtitleSize} text-white/50 text-center mb-3 sm:mb-4 sm:mb-5`}>
          {isHost ? '等待其他玩家加入...' : '已加入房间'}
        </p>

        {/* Room Code */}
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

        {/* Player List */}
        <div className="mb-3 sm:mb-4 sm:mb-5">
          <label className={`${labelSize} text-white/60 block mb-1.5 sm:mb-2`}>玩家列表 ({players.length}/4)</label>
          <div className="space-y-1 sm:space-y-1.5">
            {players.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 sm:gap-3 rounded-lg ${playerItemPadding}`}
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className={`${metaSize} text-white/40 w-3 sm:w-4`}>{idx + 1}</span>
                <span className={`text-white flex-1 truncate ${playerNameSize}`}>
                  {p.name}{p.id === players[0]?.id && isHost ? ' (房主)' : ''}
                </span>
                {p.ready ? (
                  <span className={metaSize}>已准备</span>
                ) : (
                  <span className={metaSize}>未准备</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status hint */}
        {players.length < 4 && !allReady && (
          <div className="text-center mb-3 sm:mb-4">
            <div className={hintSize}>
              {allReady ? '所有人已准备，等待房主开始...' : `需要更多玩家 (${players.length}/4)`}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1.5 sm:gap-2">
          <button
            onClick={onReadyUp}
            disabled={localPlayerReady}
            className={`flex-1 rounded-lg font-semibold transition-all ${btnPadding} ${btnFontSize}`}
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
            className={`flex-1 rounded-lg font-semibold transition-all ${btnPadding} ${btnFontSize}`}
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
