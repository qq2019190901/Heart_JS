import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from '../../game/types';

interface CardComponentProps {
  card: CardType;
  onClick?: () => void;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  animate?: boolean;
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

const CardComponent: React.FC<CardComponentProps> = memo(({
  card,
  onClick,
  faceDown = false,
  selected = false,
  disabled = false,
  small = false,
  animate = true,
}) => {
  const [hovered, setHovered] = useState(false);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const icon = SUIT_ICONS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankDisplay = getRankDisplay(card.rank);

  const w = small ? 'w-10 sm:w-14 md:w-16' : 'w-14 sm:w-18 md:w-20';
  const h = small ? 'h-14 sm:h-20 md:h-24' : 'h-20 sm:h-28 md:h-32';
  const fontSize = small ? 'text-[10px]' : 'text-xs';

  return (
    <motion.div
      className={`${w} ${h} rounded-lg cursor-pointer select-none relative flex-shrink-0 ${
        selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-emerald-800' : ''
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      style={{
        backgroundColor: faceDown ? '#1a5276' : 'white',
        boxShadow: selected
          ? '0 8px 25px rgba(46,204,113,0.4)'
          : hovered && !disabled
            ? '0 6px 20px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(0,0,0,0.2)',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
      }}
      initial={animate ? { scale: 0.8, opacity: 0, rotateY: 90 } : undefined}
      animate={animate ? { scale: 1, opacity: 1, rotateY: 0 } : undefined}
      whileHover={hovered && !disabled && !faceDown ? { scale: 1.08, y: -12, zIndex: 10 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {faceDown ? (
        <div className="w-full h-full rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1a5276 0%, #2e86c1 50%, #1a5276 100%)',
          }}>
          <div className="w-8 h-10 rounded border border-white/20 flex items-center justify-center">
            <span className="text-white/40 text-lg">♥</span>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute top-0.5 left-1 md:top-1 md:left-1.5 flex flex-col items-center">
            <span className="font-bold leading-none" style={{ color, fontSize: small ? '10px' : '12px' }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: small ? '7px' : '9px' }}>{icon}</span>
          </div>
          <div className="w-full h-full flex items-center justify-center">
            <span style={{ color, fontSize: small ? '16px' : undefined }}>{icon}</span>
          </div>
          <div className="absolute bottom-0.5 right-1 md:bottom-1 md:right-1.5 flex flex-col items-center rotate-180">
            <span className="font-bold leading-none" style={{ color, fontSize: small ? '10px' : '12px' }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: small ? '7px' : '9px' }}>{icon}</span>
          </div>
          {hovered && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, transparent 100%)',
              }}
            />
          )}
        </>
      )}
    </motion.div>
  );
});

CardComponent.displayName = 'CardComponent';

function getRankDisplay(rank: number): string {
  switch (rank) {
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    case 14: return 'A';
    default: return String(rank);
  }
}

export { CardComponent };
