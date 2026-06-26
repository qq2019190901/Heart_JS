import React, { useState, useEffect, memo } from 'react';
import type { Card } from '../../game/types';

interface ScoreBoardProps {
  players: { id: string; name: string; score: number }[];
  roundNumber: number;
  showSummary?: boolean;
  trickCardsWon?: Record<string, Card[]>;
  onContinue?: () => void;
  onRestart?: () => void;
}

const SUIT_ICONS: Record<string, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: '#e74c3c',
  diamonds: '#e67e22',
  clubs: '#2c3e50',
  spades: '#1a1a2e',
};

function getRankDisplay(rank: number): string {
  switch (rank) {
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    case 14: return 'A';
    default: return String(rank);
  }
}

function MiniCard({ card, size }: { card: Card; size: number }) {
  const icon = SUIT_ICONS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankDisplay = getRankDisplay(card.rank);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div
      className="flex-shrink-0 rounded-sm overflow-hidden"
      style={{
        width: `${size}px`,
        height: `${Math.round(size * 1.43)}px`,
        background: '#fff',
        border: '1px solid #ccc',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        fontSize: `${Math.round(size * 0.32)}px`,
        lineHeight: '1',
      }}
    >
      <div className="flex flex-col items-center h-full" style={{ padding: `${Math.round(size * 0.04)}px 0` }}>
        <div className="flex flex-col items-center leading-none">
          <span style={{ color, fontWeight: 700, fontSize: `${Math.round(size * 0.29)}px` }}>{rankDisplay}</span>
          <span style={{ color, fontSize: `${Math.round(size * 0.25)}px` }}>{icon}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color, fontSize: `${Math.round(size * 0.36)}px` }}>{icon}</span>
        </div>
        <div className="flex flex-col items-center leading-none rotate-180">
          <span style={{ color, fontWeight: 700, fontSize: `${Math.round(size * 0.29)}px` }}>{rankDisplay}</span>
          <span style={{ color, fontSize: `${Math.round(size * 0.25)}px` }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

const ScoreBoard: React.FC<ScoreBoardProps> = memo(({
  players,
  roundNumber,
  showSummary = false,
  trickCardsWon,
  onContinue,
  onRestart,
}) => {
  const [minDim, setMinDim] = useState(Math.min(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const handleResize = () => setMinDim(Math.min(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sorted = [...players].sort((a, b) => a.score - b.score);
  const winner = sorted[0];

  // Unified responsive sizing
  const isPhone = minDim < 450;
  const isTablet = minDim >= 450 && minDim < 768;
  const modalPadding = isPhone ? 'p-2' : isTablet ? 'p-3' : 'p-4 sm:p-6';
  const modalMaxWidth = isPhone ? 'max-w-[95vw]' : isTablet ? 'max-w-sm' : 'max-w-md';
  const titleSize = isPhone ? 'text-base' : isTablet ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl';
  const playerNameSize = isPhone ? 'text-[11px]' : isTablet ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  const scoreSize = isPhone ? 'text-[10px]' : isTablet ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  const btnPadding = isPhone ? 'py-1.5' : isTablet ? 'py-2' : 'py-2.5 sm:py-3';
  const btnFontSize = isPhone ? 'text-xs' : isTablet ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  const listGap = isPhone ? 'space-y-1' : isTablet ? 'space-y-1.5' : 'space-y-2 sm:space-y-3';
  const footerSize = isPhone ? 'text-[9px]' : 'text-[10px] sm:text-xs';
  // Mini card size: 20px on phone, 24px tablet, 28px desktop
  const miniCardSize = isPhone ? 20 : isTablet ? 24 : 28;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className={`relative z-10 rounded-2xl ${modalPadding} w-full ${modalMaxWidth}`}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          boxShadow: 'var(--shadow-table, 0 20px 60px rgba(0,0,0,0.5))',
        }}
        role="dialog"
        aria-label={showSummary ? '游戏结束' : `第 ${roundNumber} 回合结束`}
        aria-modal="true"
      >
        <h2 className={`${titleSize} font-bold text-white text-center mb-2 sm:mb-3 sm:mb-4`}>
          {showSummary ? '游戏结束!' : `第 ${roundNumber} 回合结束`}
        </h2>

        {/* Scores */}
        <div className={`${listGap} mb-3 sm:mb-4 sm:mb-6`}>
          {sorted.map((player, idx) => {
            const wonCards = trickCardsWon?.[player.id] || [];
            return (
              <div
                key={player.id}
                className="rounded-lg"
                style={{
                  background: idx === 0 ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)',
                  border: idx === 0 ? '1px solid rgba(46,204,113,0.3)' : '1px solid rgba(255,255,255,0.1)',
                }}
                aria-label={`${player.name} ${idx === 0 ? '获胜' : `第 ${idx + 1} 名`} 得分 ${player.score}`}
              >
                <div className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 sm:p-3">
                  <span className={`text-sm sm:text-base ${isPhone ? 'text-base' : ''}`}>
                    {idx === 0 ? '👑' : `#${idx + 1}`}
                  </span>
                  <span className={`text-white flex-1 font-medium truncate ${playerNameSize}`}>
                    {player.name}
                  </span>
                  <span className={`font-bold ${scoreSize} ${idx === 0 ? 'text-green-400' : 'text-white/70'}`}>
                    {player.score} 分
                  </span>
                </div>
                {wonCards.length > 0 && (
                  <div className={`px-1.5 pb-1.5 sm:px-2 sm:pb-2 flex flex-wrap gap-0.5 sm:gap-1`}>
                    {wonCards.map((card, ci) => (
                      <MiniCard key={ci} card={card} size={miniCardSize} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showSummary && (
          <div className={`text-center ${footerSize} text-white/40 mb-2 sm:mb-3 sm:mb-4`}>
            累计总分 &bull; 先到100分者败
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-1.5 sm:gap-2 sm:gap-3">
          {showSummary ? (
            <button
              className={`flex-1 rounded-xl font-semibold text-white transition-all ${btnPadding} ${btnFontSize}`}
              style={{
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
              }}
              onClick={onRestart}
              aria-label="重新开始游戏"
            >
              重新开始
            </button>
          ) : (
            <button
              className={`flex-1 rounded-xl font-semibold transition-all ${btnPadding} ${btnFontSize} text-white/70 hover:text-white`}
              style={{
                background: 'rgba(255,255,255,0.1)',
              }}
              onClick={onContinue}
              aria-label="继续下一回合"
            >
              下一回合
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

ScoreBoard.displayName = 'ScoreBoard';

export { ScoreBoard };
