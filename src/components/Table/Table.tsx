import React, { useState, useEffect, memo, useRef } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState(() => ({
    w: Math.max(window.innerWidth, 320),
    h: Math.max(window.innerHeight, 480),
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ w: Math.max(Math.round(width), 320), h: Math.max(Math.round(height), 480) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w: cw, h: ch } = containerSize;
  const minDim = Math.min(cw, ch);

  // ═══════════════════════════════════════════════════════════
  // RESPONSIVE SIZING
  // ═══════════════════════════════════════════════════════════
  const isPhone = minDim < 600;
  const isTablet = minDim >= 600 && minDim < 1024;

  // Card sizes
  const aiCardMinPx = isPhone ? 28 : isTablet ? 36 : 48;
  const cardW = Math.min(isPhone ? 56 : 80, Math.max(aiCardMinPx, Math.round(cw * (isPhone ? 0.1 : 0.09))));
  const cardH = Math.min(isPhone ? 78 : 112, Math.max(aiCardMinPx * 2, Math.round(ch * (isPhone ? 0.1 : 0.126))));

  // Table padding
  const TABLE_PAD = Math.max(isPhone ? 2 : 4, Math.round(minDim * 0.008));

  // AI hand offset — how far outside the table edge
  const aiHandOffset = Math.max(isPhone ? 8 : 14, Math.min(isPhone ? 40 : 60, Math.round(minDim * 0.035)));

  // Trick card overlap — BASE + STEP per card
  const trickOverlapBase = isPhone ? 12 : isTablet ? 18 : 28;
  const trickOverlapStep = Math.max(4, Math.round(minDim * 0.012));

  // Badge font sizes
  const badgeFontSize = isPhone ? '9px' : isTablet ? '10px' : undefined;
  const scoreFontSize = isPhone ? '8px' : isTablet ? '9px' : undefined;

  // Fan spacing — cards spread along the edge
  const fanStepX = Math.round(cardW * 0.22);
  const fanStepY = Math.round(cardH * 0.22);

  // Bottom occupancy — human hand area
  const bottomOccupancyRatio = isPhone ? 0.22 : isTablet ? 0.18 : 0.15;

  // Player index → side mapping
  const sideForIdx = (idx: number) => ['bottom', 'left', 'top', 'right'][idx] || 'bottom';

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-visible" role="application" aria-label="扑克牌桌">
      {/* ── AI Hands ─────────────────────────────────────────────── */}
      {players.map((player, idx) => {
        if (!player.isAi) return null;
        const aiCards = (aiHands instanceof Map ? aiHands.get(player.id) : undefined) || [];
        const displayCount = aiCards.length > 0 ? aiCards.length : 13;
        const side = sideForIdx(idx);

        const tcx = cw / 2;
        const tcy = ch / 2;
        const ex = getEdgeX(side, cw);
        const ey = getEdgeY(side, ch);

        // ── Position AI hand ──
        // Top: centered horizontally, above table
        // Left: outside left edge, shifted up to avoid bottom human area
        // Right: outside right edge, shifted up to avoid bottom human area
        let hx: string;
        let hy = side === 'top' ? ey - aiHandOffset
               : side === 'bottom' ? ey + aiHandOffset
               : (side === 'left' || side === 'right')
                 ? ch * (0.5 - bottomOccupancyRatio)
                 : tcy;

        if (side === 'left') {
          hx = `-${aiHandOffset}px`;
        } else if (side === 'right') {
          // Use right positioning to guarantee visibility
          hx = 'auto';
        } else {
          hx = `${tcx}px`;
        }

        // Fan direction
        const fx = side === 'top' || side === 'bottom' ? fanStepX : 0;
        const fy = side === 'left' || side === 'right' ? fanStepY : 0;

        // Calculate fan total size to center it
        const fanTotalW = displayCount * fx;
        const fanTotalH = displayCount * fy;

        return (
          <div
            key={`ai-cards-${player.id}`}
            style={{
              position: 'absolute',
              left: hx,
              right: side === 'right' ? `-${aiHandOffset}px` : undefined,
              top: `${hy - fanTotalH / 2}px`,
              transform: 'translate(-50%, 0)',
              zIndex: 5,
            }}
            aria-label={`${player.name} 的手牌`}
          >
            {Array.from({ length: displayCount }).map((_, ci) => {
              const cardData = aiCards[ci];
              const card = cardData || { suit: 'spades' as const, rank: 2 as const, id: `${player.id}-placeholder-${ci}` };
              return (
                <div
                  key={ci}
                  style={{
                    position: 'absolute',
                    left: `${ci * fx}px`,
                    top: `${ci * fy}px`,
                    width: `${cardW}px`,
                    height: `${cardH}px`,
                  }}
                >
                  <CardComponent
                    card={card}
                    faceDown
                    small
                    minPx={aiCardMinPx}
                    animate={false}
                    ariaLabel={`${player.name} 的一张背面牌`}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Badges ───────────────────────────────────────────────── */}
      {players.map((player, idx) => {
        const isActive = currentPlayerId === player.id;
        const isHuman = player.id === humanPlayerId;
        const side = sideForIdx(idx);
        const badgeOff = isPhone ? 8 : 14;

        // Skip bottom (human) badge — App.tsx renders the status bar separately
        // to avoid overlap with the Table container
        if (side === 'bottom') return null;

        // Badge position: centered on table edge, offset outward
        let bx: string;
        let by: string;

        if (side === 'left') {
          bx = `-${badgeOff}px`;
          by = `${ch * (0.5 - bottomOccupancyRatio)}px`;
        } else if (side === 'right') {
          bx = 'auto';
          by = `${ch * (0.5 - bottomOccupancyRatio)}px`;
        } else {
          // top
          bx = `${cw / 2}px`;
          by = `-${badgeOff}px`;
        }

        return (
          <div
            key={player.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: side === 'right' ? 'auto' : bx,
              right: side === 'right' ? `-${badgeOff}px` : undefined,
              top: by,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
            aria-label={`${player.name} ${isActive ? '(回合中)' : ''} 当前 ${player.score} 分`}
          >
            <div
              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap backdrop-blur-sm flex items-center gap-0.5 sm:gap-1 ${
                isActive
                  ? 'bg-amber-400/90 text-gray-900 shadow-lg shadow-amber-400/30'
                  : isHuman
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-black/40 text-white/80'
              }`}
              style={badgeFontSize ? { fontSize: badgeFontSize } : undefined}
            >
              {isHuman ? '你' : player.name}
              {isActive && <span className="ml-0.5 sm:ml-1 animate-pulse" aria-hidden="true">&#9679;</span>}
              <span
                className="text-white/60 bg-black/40 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full"
                style={scoreFontSize ? { fontSize: scoreFontSize } : undefined}
              >
                {player.score} 分
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Table (green felt) ───────────────────────────────────── */}
      <div
        className="rounded-xl sm:rounded-2xl md:rounded-3xl border-2 sm:border-4 md:border-8 border-amber-900/60 shadow-2xl overflow-visible"
        style={{
          position: 'absolute',
          left: `${TABLE_PAD}px`,
          top: `${TABLE_PAD}px`,
          width: `${cw - TABLE_PAD * 2}px`,
          height: `${ch - TABLE_PAD * 2}px`,
          background: 'radial-gradient(ellipse at center, var(--color-felt-light, #1a8a4a) 0%, var(--color-felt-mid, #0d6e38) 50%, var(--color-felt-dark, #094a20) 100%)',
        }}
        role="region"
        aria-label="牌桌区域"
      >
        {/* Trick cards — centered, fanning toward player sides */}
        {trick && trick.cards.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            {trick.cards.map((play, cardIdx) => {
              const playerIdx = players.findIndex(p => p.id === play.playerId);
              if (playerIdx < 0) return null;
              const side = sideForIdx(playerIdx);
              const offset = trickOverlapBase + cardIdx * trickOverlapStep;
              const tx = getTrickTX(side, offset);
              const ty = getTrickTY(side, offset);

              return (
                <div
                  key={`${play.card.id}-${cardIdx}`}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    zIndex: cardIdx + 1,
                    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
                    transition: 'transform 0.3s ease-out',
                  }}
                  aria-label={`${play.playerId} 出牌: ${play.card.rank}${play.card.suit}`}
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
            <div className="text-white/10 text-lg sm:text-2xl md:text-4xl font-bold select-none">
              出牌区
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Position helpers ──────────────────────────────────────────────────────

function getEdgeX(side: string, containerW: number): number {
  switch (side) {
    case 'bottom': return containerW / 2;
    case 'left':   return 0;
    case 'top':    return containerW / 2;
    case 'right':  return containerW;
  }
  return containerW / 2;
}

function getEdgeY(side: string, containerH: number): number {
  switch (side) {
    case 'bottom': return containerH;
    case 'left':   return containerH / 2;
    case 'top':    return 0;
    case 'right':  return containerH / 2;
  }
  return containerH / 2;
}

function getTrickTX(side: string, offset: number): number {
  switch (side) {
    case 'bottom': return 0;
    case 'left':   return -offset;
    case 'top':    return 0;
    case 'right':  return offset;
  }
  return 0;
}

function getTrickTY(side: string, offset: number): number {
  switch (side) {
    case 'bottom': return offset;
    case 'left':   return 0;
    case 'top':    return -offset;
    case 'right':  return 0;
  }
  return 0;
}

Table.displayName = 'Table';

export { Table };
