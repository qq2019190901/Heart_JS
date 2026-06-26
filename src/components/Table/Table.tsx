import React, { useState, useEffect, memo } from 'react';
import { CardComponent } from '../Card/Card';
import type { TrickState, Card } from '../../game/types';

interface TableProps {
  trick: TrickState | null;
  currentPlayerId: string;
  humanPlayerId: string;
  players: { id: string; name: string; score: number; isAi?: boolean }[];
  aiHands?: Map<string, Card[]>;
}

const Table: React.FC<TableProps> = memo(({
  trick, currentPlayerId, humanPlayerId, players, aiHands = new Map(),
}) => {
  const [isWide, setIsWide] = useState(false);
  const [dims, setDims] = useState(() => ({
    vw: window.innerWidth,
    vh: window.innerHeight,
    minDim: Math.min(window.innerWidth, window.innerHeight),
  }));

  useEffect(() => {
    const check = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setIsWide(vw >= 1024);
      setDims({ vw, vh, minDim: Math.min(vw, vh) });
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Responsive table sizing: compute width and height independently from available space.
  //
  // Width: constrained by viewport width minus AI side-hand columns + badge margin.
  //   Side AI hands stick out ~70px each, badge margin ~40px each side.
  // Height: constrained by viewport height minus top AI hand + bottom player hand + badges.
  //   Top AI hand ~120px, bottom player hand ~150px, badge margin ~40px.
  //
  // Neither dimension depends on the other — each adapts to its own constraint.

  // Width: viewport minus side margins (AI hands outside + badge clearance)
  const SIDE_MARGIN = 170; // ~70px AI hand + ~40px badge + ~60px buffer each side
  const tableWidth = `min(calc(100vw - ${SIDE_MARGIN}px), 95vw)`;

  // Height: viewport minus top/bottom margins (AI hand + player hand + badges)
  const TOP_BOTTOM_MARGIN = 320; // ~120px top AI + ~150px player hand + ~50px badges
  const tableHeight = `min(calc(100vh - ${TOP_BOTTOM_MARGIN}px), 85vh)`;

  // Trick card offset
  const trickOffset = dims.minDim < 450 ? 14 : dims.minDim < 600 ? 20 : 28;

  // Badge font scales with dimension
  const badgeFontSize = dims.minDim < 450 ? '10px' : dims.minDim < 600 ? '11px' : '';
  const scoreFontSize = dims.minDim < 450 ? '9px' : dims.minDim < 600 ? '10px' : '';

  // AI card size floor
  const aiCardMinPx = dims.minDim < 450 ? 28 : dims.minDim < 600 ? 36 : 48;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        className="relative rounded-2xl sm:rounded-3xl border-3 sm:border-8 border-amber-900/60 shadow-2xl overflow-visible"
        style={{
          width: tableWidth,
          height: tableHeight,
          background: 'radial-gradient(ellipse at center, #1a8a4a 0%, #0d6e38 50%, #094a20 100%)',
        }}
      >
        {/* Felt texture */}
        <div
          className="absolute inset-[1.5%] rounded-xl sm:rounded-2xl opacity-3 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }}
        />

        {/* AI face-down cards rendered first (outside table) */}
        {isWide && players.map((player, idx) => {
          if (!player.isAi) return null;
          const aiCards = (aiHands instanceof Map ? aiHands.get(player.id) : undefined) || [];
          const displayCount = aiCards.length > 0 ? aiCards.length : 13;
          return (
            <div key={`ai-cards-${player.id}`} className={getAiCardsAbsolutePosition(idx)}>
              {Array.from({ length: displayCount }).map((_, ci) => (
                <div key={ci} className={getAiCardWrapper(idx)}>
                  <CardComponent
                    card={{ suit: 'spades' as any, rank: 2 as any, id: `${player.id}-${ci}` }}
                    faceDown
                    small
                    minPx={aiCardMinPx}
                    animate={false}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* Player badges */}
        {players.map((player, idx) => {
          const badgeStyle = getBadgeStyle(idx, isWide);
          const isActive = currentPlayerId === player.id;
          const isHuman = player.id === humanPlayerId;

          return (
            <div
              key={player.id}
              className="absolute flex flex-col items-center gap-1 z-20"
              style={badgeStyle}
            >
              <div
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap backdrop-blur-sm flex items-center gap-1 ${
                  isActive
                    ? 'bg-amber-400/90 text-gray-900 shadow-lg shadow-amber-400/30'
                    : isHuman
                      ? 'bg-blue-500/80 text-white'
                      : 'bg-black/40 text-white/80'
                }`}
                style={badgeFontSize ? { fontSize: badgeFontSize } : undefined}
              >
                {isHuman ? '你' : player.name}
                {isActive && <span className="ml-1 animate-pulse">&#9679;</span>}
                <span
                  className="text-white/60 bg-black/40 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full"
                  style={scoreFontSize ? { fontSize: scoreFontSize } : undefined}
                >
                  {player.score} 分
                </span>
              </div>
            </div>
          );
        })}

        {/* Trick cards — positioned toward center */}
        {trick && trick.cards.length > 0 && (
          <div className="absolute inset-0">
            {trick.cards.map((play, idx) => {
              const playerIdx = players.findIndex(p => p.id === play.playerId);
              const offset = trickOffset + idx * 3;

              let transform = 'translate(-50%, -50%)';
              switch (playerIdx) {
                case 0: transform += ` translateY(${offset}px)`; break;
                case 1: transform += ` translateX(${-offset}px)`; break;
                case 2: transform += ` translateY(${-offset}px)`; break;
                case 3: transform += ` translateX(${offset}px)`; break;
              }

              return (
                <div
                  key={`${play.card.id}-${idx}`}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    zIndex: idx + 1,
                    transform,
                    transition: 'transform 0.3s ease-out',
                  }}
                >
                  <CardComponent card={play.card} faceDown={false} small minPx={aiCardMinPx} />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state hint */}
        {(!trick || trick.cards.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-white/10 text-2xl sm:text-4xl font-bold select-none">
              出牌区
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function getBadgeStyle(idx: number, _wide: boolean): React.CSSProperties {
  switch (idx) {
    case 0: return { bottom: 0, left: '50%', transform: 'translateX(-50%)' };
    case 1: return { left: 0, top: '50%', transform: 'translateY(-50%)' };
    case 2: return { top: 0, left: '50%', transform: 'translateX(-50%)' };
    case 3: return { right: 0, top: '50%', transform: 'translateY(-50%)' };
    default: return { left: 0, top: '50%', transform: 'translateY(-50%)' };
  }
}

function getAiCardsAbsolutePosition(idx: number): string {
  switch (idx) {
    case 1: return 'absolute left-[-60px] top-1/2 -translate-y-1/2 flex flex-col z-10';
    case 2: return 'absolute top-[-110px] left-1/2 -translate-x-1/2 flex flex-row z-10';
    case 3: return 'absolute right-[-50px] top-1/2 -translate-y-1/2 flex flex-col z-10';
    default: return '';
  }
}

function getAiCardWrapper(idx: number): string {
  return 'w-7 h-10 -ml-1';
}

Table.displayName = 'Table';

export { Table };
