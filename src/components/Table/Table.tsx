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
          const w = Math.max(Math.round(width), 320);
          const h = Math.max(Math.round(height), 480);
          setContainerSize({ w, h });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { w: cw, h: ch } = containerSize;
  const minDim = Math.min(cw, ch);

  // ═══════════════════════════════════════════════════════════
  // LINEAR RESPONSIVE SIZING (based on maxDim, no caps)
  // ═══════════════════════════════════════════════════════════
  const d = Math.max(300, Math.min(cw, ch));
  const t = (d - 300) / 1100; // 0..1 at minDim=1400, grows beyond

  // Card sizes — based on container width, no upper cap
  const aiCardMinPx = Math.round(28 + t * 72); // 28px → 100px+

  // Card width/height scale with container
  const cardW = Math.max(aiCardMinPx, Math.round(cw * 0.09));
  const cardH = Math.max(aiCardMinPx * 2, Math.round(ch * 0.126));

  // Table padding — linear from 2px → 6px
  const TABLE_PAD = Math.round(2 + t * 4);

  // AI hand offset — linear from 8px → 60px
  const aiHandOffset = Math.round(8 + t * 52);

  // Right hand offset — linear from 20px → 120px
  const rightHandOffset = Math.round(20 + t * 100);

  // Trick card overlap — linear from 12px → 36px base, step from 4px → 14px
  const trickOverlapBase = Math.round(12 + t * 24);
  const trickOverlapStep = Math.max(4, Math.round(4 + t * 10));

  // Badge font sizes — linear pixel values
  const badgeFontSizePx = Math.round(9 + t * 5); // 9px → 14px
  const scoreFontSizePx = Math.round(8 + t * 4); // 8px → 12px

  // Fan spacing — cards spread along the edge
  const fanStepX = Math.round(cardW * 0.22);
  const fanStepY = Math.round(cardH * 0.22);

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
        // Left: outside left edge, vertically centered in visible area
        // Right: outside right edge, vertically centered in visible area
        let hx: string;
        let hy = side === 'top' ? ey - aiHandOffset
               : side === 'bottom' ? ey + aiHandOffset
               : tcy;

        if (side === 'left') {
          hx = `-${aiHandOffset}px`;
        } else if (side === 'right') {
          hx = 'auto';
        } else {
          hx = `${tcx}px`;
        }

        // Fan direction
        const fx = side === 'top' || side === 'bottom' ? fanStepX : 0;
        const fy = side === 'left' || side === 'right' ? fanStepY : 0;

        // Calculate fan total size to center it
        // Actual visual width = first card's left edge to last card's right edge
        const fanTotalW = (displayCount - 1) * fx + cardW;
        const fanTotalH = (displayCount - 1) * fy + cardH;

        return (
          <div
            key={`ai-cards-${player.id}`}
            style={{
              position: 'absolute',
              ...(side === 'left' && { left: `-${aiHandOffset}px`, top: `${tcy - fanTotalH / 2}px`, transform: 'translate(0, 0)' }),
              ...(side === 'right' && { right: `${rightHandOffset}px`, top: `${tcy - fanTotalH / 2}px`, transform: 'translate(0, 0)' }),
              ...(side === 'top' && { left: `${tcx}px`, top: `${ey - aiHandOffset - fanTotalH / 2}px`, transform: 'translate(-50%, 0)' }),
              ...(side === 'bottom' && { left: `${tcx}px`, top: `${ey + aiHandOffset - fanTotalH / 2}px`, transform: 'translate(-50%, 0)' }),
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
                    left: `${-fanTotalW / 2 + ci * fx + cardW / 2}px`,
                    top: `${-fanTotalH / 2 + ci * fy + cardH / 2}px`,
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
        const badgeOff = Math.round(8 + t * 10);
        const tcy = ch / 2;

        // Skip bottom (human) badge — App.tsx renders the status bar separately
        // to avoid overlap with the Table container
        if (side === 'bottom') return null;

        // Badge position: centered on table edge, offset outward
        let bx: string;
        let by: string;

        if (side === 'left') {
          bx = `-${badgeOff}px`;
          by = `${tcy}px`;
        } else if (side === 'right') {
          bx = 'auto';
          by = `${tcy}px`;
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
              style={{ fontSize: `${badgeFontSizePx}px` }}
            >
              {isHuman ? '你' : player.name}
              {isActive && <span className="ml-0.5 sm:ml-1 animate-pulse" aria-hidden="true">&#9679;</span>}
              <span
                className="text-white/60 bg-black/40 px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded-full"
                style={{ fontSize: `${scoreFontSizePx}px` }}
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
