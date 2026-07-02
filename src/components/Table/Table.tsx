import React, { useState, useEffect, memo, useRef } from 'react';
import { CardComponent } from '../Card/Card';
import type { TrickState, Card } from '../../game/types';

interface TableProps {
  trick: TrickState | null;
  currentPlayerId: string;
  humanPlayerId: string;
  players: { id: string; name: string; score: number; isAi?: boolean }[];
  aiHands?: Map<string, Card[]>;
  // Responsive params (computed in App)
  aiCardMinPx: number;
  cardW: number;
  cardH: number;
  tablePad: number;
  aiHandOffset: number;
  trickOverlapBase: number;
  trickOverlapStep: number;
  badgeOff: number;
  badgeFontSizePx: number;
  scoreFontSizePx: number;
  fanStepX: number;
  fanStepY: number;
  turnStatus?: React.ReactNode;
}

const Table: React.FC<TableProps> = memo(({
  trick, currentPlayerId, humanPlayerId, players, aiHands = new Map(),
  aiCardMinPx, cardW, cardH, tablePad, aiHandOffset,
  trickOverlapBase, trickOverlapStep, badgeOff, badgeFontSizePx, scoreFontSizePx,
  fanStepX, fanStepY,
  turnStatus,
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

  // ── Layout strategy: position AI hands first, then place table to fill the rest ──

  // Top AI hand: horizontal fan, pinned to top edge, horizontally centered
  const topFanW = (13 - 1) * fanStepX + cardW;
  const topHandLeft = (cw - topFanW) / 2;
  const topHandTop = 0;
  const topHandBottom = topHandTop + cardH;

  // Left AI hand: vertical fan, pinned to left edge, vertically centered
  const leftFanH = (13 - 1) * fanStepY + cardH;
  const leftHandLeft = 0;
  const leftHandTop = (ch - leftFanH) / 2;
  const leftHandRight = leftHandLeft + cardW;

  // Right AI hand: vertical fan, pinned to right edge, vertically centered
  const rightHandLeft = cw - cardW;
  const rightHandTop = (ch - leftFanH) / 2;
  const rightHandBottom = rightHandTop + cardH;

  // Table fills the space between AI hands
  const tableLeft = leftHandRight;
  const tableTop = topHandBottom;
  const tableRight = rightHandLeft;
  const tableBottom = ch; // extends to bottom (below table is human hand area)
  const tableW = tableRight - tableLeft;
  const tableH = tableBottom - tableTop;

  // Center of the table
  const tcx = tableLeft + tableW / 2;
  const tcy = tableTop + tableH / 2;

  const sideForIdx = (idx: number) => ['bottom', 'left', 'top', 'right'][idx] || 'bottom';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-visible" role="application" aria-label="扑克牌桌">
      {/* ── AI Hands ─────────────────────────────────────────────── */}
      {players.map((player, idx) => {
        if (!player.isAi) return null;
        const aiCards = (aiHands instanceof Map ? aiHands.get(player.id) : undefined) || [];
        const displayCount = aiCards.length > 0 ? aiCards.length : 13;
        const side = sideForIdx(idx);

        // Fan direction
        const isHorizontal = side === 'top' || side === 'bottom';
        const fanSpacing = isHorizontal ? fanStepX : fanStepY;
        const fanTotalSize = (displayCount - 1) * fanSpacing + (isHorizontal ? cardW : cardH);

        // Position AI hand based on its side
        let handStyle: React.CSSProperties;
        if (side === 'left') {
          handStyle = { left: `${leftHandLeft}px`, top: `${leftHandTop}px` };
        } else if (side === 'right') {
          handStyle = { left: `${rightHandLeft}px`, top: `${rightHandTop}px` };
        } else if (side === 'top') {
          handStyle = { left: `${topHandLeft}px`, top: `${topHandTop}px` };
        } else {
          // bottom — shouldn't render (human hand is at bottom)
          handStyle = {};
        }

        return (
          <div
            key={`ai-cards-${player.id}`}
            style={{
              position: 'absolute',
              ...handStyle,
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
                    left: isHorizontal ? `${ci * fanSpacing}px` : '0px',
                    top: isHorizontal ? '0px' : `${ci * fanSpacing}px`,
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

        // Skip bottom (human) badge — rendered below the table near player hand
        if (side === 'bottom') return null;

        let badgeLeft: number;
        let badgeTop: number;

        if (side === 'left') {
          badgeLeft = tableLeft + badgeOff;
          badgeTop = tcy;
        } else if (side === 'right') {
          badgeLeft = tableRight - badgeOff;
          badgeTop = tcy;
        } else {
          // top
          badgeLeft = tcx;
          badgeTop = tableTop + badgeOff;
        }

        return (
          <div
            key={player.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: `${badgeLeft}px`,
              top: `${badgeTop}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
            aria-label={`${player.name} ${isActive ? '(回合中)' : ''} 当前 ${player.score} 分`}
          >
            <div
              className={`px-1.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap backdrop-blur-sm flex items-center gap-0.5 ${
                isActive
                  ? 'bg-amber-400/90 text-gray-900 shadow-lg shadow-amber-400/30'
                  : isHuman
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-black/40 text-white/80'
              }`}
              style={{ fontSize: `${badgeFontSizePx}px` }}
            >
              {isHuman ? '你' : player.name}
              {isActive && <span className="ml-0.5 animate-pulse" aria-hidden="true">&#9679;</span>}
              <span
                className="text-white/60 bg-black/40 px-1 py-0.5 rounded-full"
                style={{ fontSize: `${scoreFontSizePx}px` }}
              >
                {player.score} 分
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Human Player Badge (bottom) ──────────────────────────── */}
      {(() => {
        const humanPlayer = players.find(p => p.id === humanPlayerId);
        if (!humanPlayer) return null;
        const isActive = currentPlayerId === humanPlayerId;
        const badgeLeft = tcx;
        const badgeTop = tableBottom - badgeOff;
        return (
          <div
            key={humanPlayer.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: `${badgeLeft}px`,
              top: `${badgeTop}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}
            aria-label={`${humanPlayer.name} 当前 ${humanPlayer.score} 分`}
          >
            <div
              className={`px-1.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap backdrop-blur-sm flex items-center gap-0.5 ${
                isActive
                  ? 'bg-amber-400/90 text-gray-900 shadow-lg shadow-amber-400/30'
                  : 'bg-blue-500/80 text-white'
              }`}
              style={{ fontSize: `${badgeFontSizePx}px` }}
            >
              {humanPlayer.name}
              {isActive && <span className="ml-0.5 animate-pulse" aria-hidden="true">&#9679;</span>}
              <span
                className="text-white/60 bg-black/40 px-1 py-0.5 rounded-full"
                style={{ fontSize: `${scoreFontSizePx}px` }}
              >
                {humanPlayer.score} 分
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Turn Status (above table bottom edge) ────────────────── */}
      {turnStatus && (
        <div
          className="pointer-events-none"
          style={{
            position: 'absolute',
            left: `${tcx}px`,
            top: `${tableBottom - 40}px`,
            transform: 'translate(-50%, 0)',
            zIndex: 10,
          }}
          aria-live="polite"
          role="status"
        >
          <div style={{ fontSize: `${badgeFontSizePx}px` }}>
            {turnStatus}
          </div>
        </div>
      )}

      {/* ── Table (green felt) ───────────────────────────────────── */}
      <div
        className="rounded-xl border-amber-900/60 shadow-2xl overflow-visible"
        style={{
          position: 'absolute',
          left: `${tableLeft}px`,
          top: `${tableTop}px`,
          width: `${tableW}px`,
          height: `${tableH}px`,
          background: 'radial-gradient(ellipse at center, var(--color-felt-light, #1a8a4a) 0%, var(--color-felt-mid, #0d6e38) 50%, var(--color-felt-dark, #094a20) 100%)',
        }}
        role="region"
        aria-label="牌桌区域"
      >
        {/* Trick cards */}
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
            <div className="text-white/10 text-lg font-bold select-none">
              出牌区
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Position helpers ──────────────────────────────────────────────────────

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
