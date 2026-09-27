import React, { useState, useEffect, memo, useRef } from 'react';
import { CardComponent } from '../Card/Card';
import type { TrickState, Card } from '../../game/types';
import { cardPoints } from '../../game/deck';

interface TableProps {
  trick: TrickState | null;
  currentPlayerId: string;
  humanPlayerId: string;
  players: { id: string; name: string; score: number; isAi?: boolean }[];
  aiHands?: Map<string, Card[]>;
  // Responsive params (computed in App)
  aiCardMinPx: number;
  aiHandOffset: number;
  trickOverlapBase: number;
  trickOverlapStep: number;
  badgeOff: number;
  badgeFontSizePx: number;
  scoreFontSizePx: number;
  fanStepX: number;
  fanStepY: number;
  trickCardMinPx?: number;
  turnStatus?: React.ReactNode;
  passConfirmAction?: React.ReactNode;
  settlementCards?: Record<string, Card[]>;
}

const Table: React.FC<TableProps> = memo(({
  trick, currentPlayerId, humanPlayerId, players, aiHands = new Map(),
  aiCardMinPx, aiHandOffset,
  trickOverlapBase, trickOverlapStep, badgeOff, badgeFontSizePx, scoreFontSizePx,
  fanStepX, fanStepY, trickCardMinPx,
  turnStatus,
  passConfirmAction,
  settlementCards,
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

  // AI card actual rendered size (small mode: minPx × minPx*1.5)
  const aiCardW = aiCardMinPx;
  const aiCardH = Math.round(aiCardMinPx * 1.5);

  // Top AI hand: horizontal fan, pinned to top edge, horizontally centered
  // In compact/landscape views, pin to top (offset=0) to maximize table height.
  // aiHandOffset is still used for left/right inset.
  const topFanW = (13 - 1) * fanStepX + aiCardW;
  const topHandLeft = (cw - topFanW) / 2;
  const topHandTop = 0;
  const topHandBottom = aiCardH;

  // Left AI hand: vertical fan, inset from left edge
  const leftFanH = (13 - 1) * fanStepY + aiCardH;
  const leftHandLeft = aiHandOffset;
  const leftHandTop = (ch - leftFanH) / 2;
  const leftHandRight = leftHandLeft + aiCardW;

  // Right AI hand: vertical fan, inset from right edge
  const rightHandLeft = cw - aiCardW - aiHandOffset;
  const rightHandTop = (ch - leftFanH) / 2;

  // Table fills the space between AI hands
  const tableLeft = leftHandRight;
  const tableTop = topHandBottom;
  const tableRight = rightHandLeft;
  const tableBottom = ch;
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
          const settlement = settlementCards?.[player.id]?.filter(c => cardPoints(c) > 0) || [];
          const aiCards = settlement.length > 0 ? settlement : (aiHands instanceof Map ? aiHands.get(player.id) : undefined) || [];
          const displayCount = aiCards.length > 0 ? aiCards.length : 0;
          const side = sideForIdx(idx);

          // Fan direction
          const isHorizontal = side === 'top' || side === 'bottom';
          const fanSpacing = isHorizontal ? fanStepX : fanStepY;

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
                    key={`${player.id}-${ci}`}
                    className=""
                    style={{
                      position: 'absolute',
                      left: isHorizontal ? `${ci * fanSpacing}px` : '0px',
                      top: isHorizontal ? '0px' : `${ci * fanSpacing}px`,
                      width: `${aiCardMinPx}px`,
                      height: `${Math.round(aiCardMinPx * 1.5)}px`,
                    }}
                  >
                    <CardComponent
                      card={card}
                      faceDown={settlement.length === 0}
                      small
                      minPx={aiCardMinPx}
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
              className="px-1.5 py-0 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-0.5"
              style={{
                fontSize: `${badgeFontSizePx}px`,
                background: isActive ? 'var(--badge-active, #fbbf24)' : isHuman ? 'var(--badge-human, #3b82f6)' : 'var(--badge-other, rgba(255,255,255,0.08))',
                color: isActive ? 'var(--badge-active-text, #1a1a00)' : 'var(--badge-text, rgba(255,255,255,0.85))',
                boxShadow: isActive ? '0 2px 8px var(--accent-glow, rgba(46,204,113,0.3))' : 'var(--shadow-badge, 0 4px 12px rgba(0,0,0,0.15))',
              }}
            >
              {isHuman ? '你' : player.name}
              {isActive && <span className="ml-0.5 animate-pulse" aria-hidden="true">&#9679;</span>}
              <span
                className="rounded-full"
                style={{
                  fontSize: `${scoreFontSizePx}px`,
                  background: 'var(--badge-score-bg, rgba(0,0,0,0.4))',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '0 4px',
                }}
              >
                {player.score} 分
              </span>
            </div>
          </div>
        );
      })}

      {/* ── Human Player Badge (bottom) — positioned below table ── */}
      {/* Rendered outside table bounds to avoid clipping */}
      {(() => {
        const humanPlayer = players.find(p => p.id === humanPlayerId);
        if (!humanPlayer) return null;
        const isActive = currentPlayerId === humanPlayerId;
        const badgeLeft = tcx;
        // Position badge just below the table, with reduced spacing
        const badgeTop = tableBottom - 16;
        return (
          <div
            key={humanPlayer.id}
            className="pointer-events-auto"
            style={{
              position: 'absolute',
              left: `${badgeLeft}px`,
              top: `${badgeTop}px`,
              transform: 'translate(-50%, 0)',
              zIndex: 10,
            }}
            aria-label={`${humanPlayer.name} 当前 ${humanPlayer.score} 分`}
          >
            <div
              className="px-1.5 py-0 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-0.5"
              style={{
                fontSize: `${badgeFontSizePx}px`,
                background: isActive ? 'var(--badge-active, #fbbf24)' : 'var(--badge-human, #3b82f6)',
                color: isActive ? 'var(--badge-active-text, #1a1a00)' : 'var(--badge-text, #fff)',
                boxShadow: isActive ? '0 2px 8px var(--accent-glow, rgba(46,204,113,0.3))' : 'var(--shadow-badge, 0 4px 12px rgba(0,0,0,0.15))',
              }}
            >
              <span>{humanPlayer.name}</span>
              {isActive && <span className="animate-pulse" aria-hidden="true">●</span>}
              <span
                className="rounded-full"
                style={{
                  fontSize: `${badgeFontSizePx}px`,
                  background: 'var(--badge-score-bg, rgba(0,0,0,0.4))',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '0 4px',
                }}
              >
                {humanPlayer.score}分
              </span>
              {passConfirmAction}
            </div>
          </div>
        );
      })()}

      {/* ── Turn Status (above human area) ──────────────────────── */}
      {turnStatus && (() => {
        // Badge occupies ~badgeFontSizePx+10px, sitting at tableBottom-16.
        // Text box bottom sits just above badge with 4px gap.
        const badgeH = badgeFontSizePx + 10;
        const statusTop = tableBottom - 16 - badgeH - 4 - (badgeFontSizePx + 1);
        const statusH = badgeFontSizePx + 8;
        return (
          <div
            className="pointer-events-none"
            style={{
              position: 'absolute',
              left: `${tcx}px`,
              top: `${statusTop}px`,
              transform: 'translate(-50%, 0)',
              zIndex: 11,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'flex-end',
              height: `${statusH}px`,
            }}
            aria-live="polite"
            role="status"
          >
            <div style={{ fontSize: `${badgeFontSizePx + 1}px`, lineHeight: '1.2' }}>
              {turnStatus}
            </div>
          </div>
        );
      })()}

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div
        className="overflow-visible"
        style={{
          position: 'absolute',
          left: `${tableLeft}px`,
          top: `${tableTop}px`,
          width: `${tableW}px`,
          height: `${tableH}px`,
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'transparent',
          boxShadow: 'none',
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
              // Constrain offset so cards stay within table bounds (prevent clipping)
              const maxOffset = Math.min(tableW, tableH) / 2 - 4;
              const offset = Math.min(trickOverlapBase + cardIdx * trickOverlapStep, maxOffset);
              const tx = getTrickTX(side, offset);
              const ty = getTrickTY(side, offset);

              return (
                <div
                  key={`${play.card.id}-${cardIdx}`}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    zIndex: cardIdx + 20,
                    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px)`,
                    transition: 'transform 0.3s ease-out',
                  }}
                  aria-label={`${play.playerId} 出牌: ${play.card.rank}${play.card.suit}`}
                >
                  <CardComponent card={play.card} faceDown={false} small minPx={trickCardMinPx ?? aiCardMinPx} />
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
