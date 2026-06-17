import React, { memo } from 'react';
import { motion } from 'framer-motion';
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

function MiniCard({ card }: { card: Card }) {
  const icon = SUIT_ICONS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankDisplay = getRankDisplay(card.rank);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div
      className="flex-shrink-0 rounded-sm overflow-hidden"
      style={{
        width: '28px',
        height: '40px',
        background: '#fff',
        border: '1px solid #ccc',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        fontSize: '9px',
        lineHeight: '1',
      }}
    >
      <div className="flex flex-col items-center h-full" style={{ padding: '1px 0' }}>
        {/* Top rank + suit */}
        <div className="flex flex-col items-center leading-none">
          <span style={{ color, fontWeight: 700, fontSize: '8px' }}>{rankDisplay}</span>
          <span style={{ color, fontSize: '7px' }}>{icon}</span>
        </div>
        {/* Center suit */}
        <div className="flex-1 flex items-center justify-center">
          <span style={{ color, fontSize: '10px' }}>{icon}</span>
        </div>
        {/* Bottom rank + suit (rotated) */}
        <div className="flex flex-col items-center leading-none rotate-180">
          <span style={{ color, fontWeight: 700, fontSize: '8px' }}>{rankDisplay}</span>
          <span style={{ color, fontSize: '7px' }}>{icon}</span>
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
  const sorted = [...players].sort((a, b) => a.score - b.score);
  const winner = sorted[0];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <motion.div
        className="relative z-10 rounded-2xl p-4 sm:p-6 w-full max-w-md"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-3 sm:mb-4">
          {showSummary ? '游戏结束!' : `第 ${roundNumber} 回合结束`}
        </h2>

        {/* Scores */}
        <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
          {sorted.map((player, idx) => {
            const wonCards = trickCardsWon?.[player.id] || [];
            return (
              <motion.div
                key={player.id}
                className="rounded-lg"
                style={{
                  background: idx === 0 ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)',
                  border: idx === 0 ? '1px solid rgba(46,204,113,0.3)' : '1px solid rgba(255,255,255,0.1)',
                }}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3">
                  <span className="text-base sm:text-lg">{idx === 0 ? '👑' : `#${idx + 1}`}</span>
                  <span className="text-white flex-1 font-medium text-sm sm:text-base truncate">{player.name}</span>
                  <span className={`font-bold text-sm sm:text-base ${idx === 0 ? 'text-green-400' : 'text-white/70'}`}>
                    {player.score} 分
                  </span>
                </div>
                {wonCards.length > 0 && (
                  <div className="px-2 pb-2 flex flex-wrap gap-1">
                    {wonCards.map((card, ci) => (
                      <MiniCard key={ci} card={card} />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {showSummary && (
          <div className="text-center text-white/40 text-xs mb-3 sm:mb-4">
            累计总分 &bull; 先到100分者败
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 sm:gap-3">
          {showSummary ? (
            <button
              className="flex-1 py-2.5 sm:py-3 rounded-xl font-semibold text-white text-sm sm:text-base transition-all"
              style={{
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
              }}
              onClick={onRestart}
            >
              重新开始
            </button>
          ) : (
            <button
              className="flex-1 py-2.5 sm:py-3 rounded-xl font-semibold text-white/70 hover:text-white transition-all text-sm sm:text-base"
              style={{
                background: 'rgba(255,255,255,0.1)',
              }}
              onClick={onContinue}
            >
              下一回合
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

ScoreBoard.displayName = 'ScoreBoard';

export { ScoreBoard };
