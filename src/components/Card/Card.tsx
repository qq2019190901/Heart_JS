import React, { useState, memo } from 'react';
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
  hearts: '#C62828',
  diamonds: '#C62828',
  clubs: '#1A1A1A',
  spades: '#1A1A1A',
};

// Face card center symbols
const FACE_SYMBOLS: Record<number, string> = {
  11: '\u2658',
  12: '\u2655',
  13: '\u2654',
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
  const icon = SUIT_ICONS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankDisplay = getRankDisplay(card.rank);

  const w = small ? 'w-10 sm:w-14 md:w-16' : 'w-14 sm:w-18 md:w-20';
  const h = small ? 'h-14 sm:h-20 md:h-24' : 'h-20 sm:h-28 md:h-32';

  // Standard playing card pip layout
  const pipLayout = getPipLayout(card.rank);
  const pipSize = getPipSize(card.rank, small);

  // Pre-computed classes to avoid runtime string concat
  const classes = [
    w,
    h,
    'rounded-lg cursor-pointer select-none relative flex-shrink-0',
    selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-emerald-800' : '',
    disabled ? 'cursor-not-allowed' : '',
  ].filter(Boolean).join(' ');

  // Pre-computed box-shadow values
  let boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  if (selected) boxShadow = '0 8px 25px rgba(46,204,113,0.4)';
  else if (hovered && !disabled) boxShadow = '0 6px 20px rgba(0,0,0,0.3)';

  return (
    <div
      className={classes}
      style={{
        backgroundColor: faceDown ? '#1a5276' : 'white',
        boxShadow,
        transform: hovered && !disabled && !faceDown ? 'translateY(-8px) scale(1.05)' : undefined,
        transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
        willChange: hovered ? 'transform' : undefined,
        WebkitBackfaceVisibility: 'hidden',
        backfaceVisibility: 'hidden',
      }}
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {faceDown ? (
        <div
          className="w-full h-full rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #1a5276 0%, #2e86c1 50%, #1a5276 100%)',
          }}
        >
          <div className="w-8 h-10 rounded border border-white/20 flex items-center justify-center">
            <span className="text-white/40 text-lg">♥</span>
          </div>
        </div>
      ) : (
        <>
          {/* Top-left corner */}
          <div className="absolute top-[3%] left-[5%] flex flex-col items-center">
            <span className="font-bold leading-none" style={{ color, fontSize: small ? '9px' : '11px' }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: small ? '6px' : '8px' }}>{icon}</span>
          </div>

          {/* Center pips */}
          <div className="absolute" style={{ top: '12%', bottom: '12%', left: '14%', right: '14%' }}>
            {pipLayout.map((pos, i) => {
              const displayChar = (card.rank >= 11 && card.rank <= 13)
                ? FACE_SYMBOLS[card.rank]
                : icon;
              return (
                <span
                  key={i}
                  className="absolute"
                  style={{
                    color,
                    fontSize: pipSize,
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {displayChar}
                </span>
              );
            })}
          </div>

          {/* Bottom-right corner (rotated) */}
          <div className="absolute bottom-[3%] right-[5%] flex flex-col items-center rotate-180">
            <span className="font-bold leading-none" style={{ color, fontSize: small ? '9px' : '11px' }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: small ? '6px' : '8px' }}>{icon}</span>
          </div>

          {/* Hover gloss */}
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
    </div>
  );
});

CardComponent.displayName = 'CardComponent';

// Standard playing card pip layout
function getPipLayout(rank: number): { x: number; y: number }[] {
  switch (rank) {
    case 2:
      return [{ x: 25, y: 25 }, { x: 75, y: 75 }];
    case 3:
      return [{ x: 50, y: 22 }, { x: 50, y: 50 }, { x: 50, y: 78 }];
    case 4:
      return [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 25, y: 75 }, { x: 75, y: 75 }];
    case 5:
      return [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 50, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 75 }];
    case 6:
      return [{ x: 25, y: 20 }, { x: 75, y: 20 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 25, y: 80 }, { x: 75, y: 80 }];
    case 7:
      return [{ x: 25, y: 18 }, { x: 75, y: 18 }, { x: 50, y: 35 }, { x: 25, y: 55 }, { x: 75, y: 55 }, { x: 25, y: 82 }, { x: 75, y: 82 }];
    case 8:
      return [{ x: 25, y: 15 }, { x: 75, y: 15 }, { x: 50, y: 30 }, { x: 25, y: 50 }, { x: 75, y: 50 }, { x: 50, y: 70 }, { x: 25, y: 85 }, { x: 75, y: 85 }];
    case 9:
      return [{ x: 25, y: 14 }, { x: 75, y: 14 }, { x: 50, y: 26 }, { x: 25, y: 44 }, { x: 75, y: 44 }, { x: 50, y: 56 }, { x: 25, y: 74 }, { x: 75, y: 74 }, { x: 50, y: 86 }];
    case 10:
      return [{ x: 25, y: 12 }, { x: 75, y: 12 }, { x: 50, y: 22 }, { x: 25, y: 36 }, { x: 75, y: 36 }, { x: 50, y: 50 }, { x: 25, y: 64 }, { x: 75, y: 64 }, { x: 50, y: 78 }, { x: 25, y: 90 }, { x: 75, y: 90 }];
    case 11: // J
    case 12: // Q
    case 13: // K
    case 14: // A
      return [{ x: 50, y: 50 }];
    default:
      return [{ x: 50, y: 50 }];
  }
}

// Pip size based on rank and card size
function getPipSize(rank: number, small: boolean): string {
  if (small) {
    if (rank === 14) return '14px';
    if (rank >= 11 && rank <= 13) return '28px';
    if (rank <= 4) return '12px';
    if (rank <= 7) return '9px';
    return '7px';
  }
  if (rank === 14) return '40px';
  if (rank === 12) return '32px';
  if (rank >= 11 && rank <= 13) return '35px';
  if (rank <= 4) return '32px';
  if (rank <= 6) return '26px';
  if (rank <= 8) return '20px';
  if (rank <= 9) return '16px';
  return '13px';
}

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
