import React, { useState, memo } from 'react';
import type { Card as CardType } from '../../game/types';

interface CardComponentProps {
  card: CardType;
  onClick?: () => void;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Extra-small size for AI hands, trick area, pass selection */
  small?: boolean;
  /** Minimum size floor in pixels (for very compact screens) */
  minPx?: number;
  animate?: boolean;
  /** Accessibility label */
  ariaLabel?: string;
  /** Keyboard handler */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  tabIndex?: number;
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

// Face card center symbols — use standard poker face icons
const FACE_SYMBOLS: Record<number, string> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const CardComponent: React.FC<CardComponentProps> = memo(({
  card,
  onClick,
  faceDown = false,
  selected = false,
  disabled = false,
  small = false,
  minPx = 48,
  animate = true,
  ariaLabel,
  onKeyDown,
  tabIndex = 0,
}) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const icon = SUIT_ICONS[card.suit];
  const color = SUIT_COLORS[card.suit];
  const rankDisplay = getRankDisplay(card.rank);

  // Dynamic card dimensions using CSS clamp for smooth scaling.
  // IMPORTANT: Do NOT override these with inline width/height — let CSS handle it.
  const cardW = small
    ? `clamp(${minPx}px, 9vw, 80px)`
    : `clamp(64px, 16vw, 120px)`;
  const cardH = small
    ? `clamp(${Math.round(minPx * 1.4)}px, 12.6vw, 112px)`
    : `clamp(90px, 22.4vw, 168px)`;

  // Corner text sizes scale proportionally
  const cornerFontSize = small
    ? `clamp(${Math.round(minPx * 0.22)}px, 2.8vw, 16px)`
    : `clamp(11px, 2.2vw, 18px)`;
  const suitFontSize = small
    ? `clamp(${Math.round(minPx * 0.16)}px, 2vw, 12px)`
    : `clamp(8px, 1.6vw, 14px)`;

  // Center pip sizes
  const pipLayout = getPipLayout(card.rank);
  const pipSize = getPipSize(card.rank, small, minPx);

  const classes = [
    'rounded-lg cursor-pointer select-none relative flex-shrink-0 gpu-accelerated',
    selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-emerald-800' : '',
    disabled ? 'cursor-not-allowed' : '',
    focused ? 'ring-2 ring-blue-400 ring-offset-1' : '',
  ].filter(Boolean).join(' ');

  let boxShadow = 'var(--shadow-card, 0 2px 8px rgba(0,0,0,0.2))';
  if (selected) boxShadow = 'var(--shadow-card-selected, 0 8px 25px rgba(46,204,113,0.4))';
  else if (hovered && !disabled) boxShadow = 'var(--shadow-card-hover, 0 6px 20px rgba(0,0,0,0.3))';

  // Accessible label: "Ace of Spades" etc.
  const label = ariaLabel || `${getRankDisplay(card.rank)} of ${card.suit}`;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled && onClick) onClick();
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div
      className={classes}
      style={{
        width: cardW,
        height: cardH,
        backgroundColor: faceDown ? 'var(--color-card-face-down-top, #1a5276)' : 'white',
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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : tabIndex}
      role={disabled ? undefined : 'button'}
      aria-label={label}
      aria-disabled={disabled}
    >
      {faceDown ? (
        <div
          className="w-full h-full rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-card-face-down-top, #1a5276) 0%, var(--color-card-face-down-mid, #2e86c1) 50%, var(--color-card-face-down-top, #1a5276) 100%)',
          }}
        >
          <div
            className="w-8 h-10 rounded border border-white/20 flex items-center justify-center"
            style={{
              width: `clamp(24px, 5vw, 36px)`,
              height: `clamp(30px, 6vw, 44px)`,
            }}
          >
            <span className="text-white/40">♥</span>
          </div>
        </div>
      ) : (
        <>
          {/* Top-left corner */}
          <div className="absolute top-[3%] left-[5%] flex flex-col items-center">
            <span className="font-bold leading-none" style={{ color, fontSize: cornerFontSize }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: suitFontSize }}>{icon}</span>
          </div>

          {/* Center pips */}
          <div className="absolute" style={{ top: '12%', bottom: '12%', left: '14%', right: '14%' }}>
            {pipLayout.map((pos, i) => {
              const displayChar = (card.rank >= 11 && card.rank <= 13)
                ? FACE_SYMBOLS[card.rank] ?? icon
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
            <span className="font-bold leading-none" style={{ color, fontSize: cornerFontSize }}>{rankDisplay}</span>
            <span className="leading-none" style={{ color, fontSize: suitFontSize }}>{icon}</span>
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
    case 11:
    case 12:
    case 13:
    case 14:
      return [{ x: 50, y: 50 }];
    default:
      return [{ x: 50, y: 50 }];
  }
}

function getPipSize(rank: number, small: boolean, minPx: number): string {
  const base = small ? minPx * 0.35 : minPx * 0.4;
  if (rank >= 11 && rank <= 13) return `${Math.round(base * 2.2)}px`;
  if (rank <= 4) return `${Math.round(base * 0.9)}px`;
  if (rank <= 6) return `${Math.round(base * 0.7)}px`;
  if (rank <= 8) return `${Math.round(base * 0.55)}px`;
  if (rank <= 9) return `${Math.round(base * 0.45)}px`;
  return `${Math.round(base * 0.35)}px`;
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
