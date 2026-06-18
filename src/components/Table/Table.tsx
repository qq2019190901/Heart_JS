import React, { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    const check = () => setIsWide(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        className="relative rounded-3xl border-4 sm:border-8 border-amber-900/60 shadow-2xl overflow-visible"
        style={{
          width: isWide ? 'min(75vw, 900px)' : 'min(96vw, 500px)',
          height: isWide ? 'min(70vh, 600px)' : 'min(65vh, 480px)',
          background: 'radial-gradient(ellipse at center, #1a8a4a 0%, #0d6e38 50%, #094a20 100%)',
        }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Felt texture */}
        <div
          className="absolute inset-[1.5%] rounded-2xl opacity-3 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          }}
        />

        {/* AI face-down cards + Player badges */}
        {/* AI cards rendered first (outside table), then badges on top */}
        {isWide && players.map((player, idx) => {
          if (!player.isAi) return null;
          const aiCards = aiHands.get(player.id) || [];
          const displayCount = aiCards.length > 0 ? aiCards.length : Math.ceil(13 / (players.length - 1));
          return (
            <div key={`ai-cards-${player.id}`} className={getAiCardsAbsolutePosition(idx)}>
              {Array.from({ length: displayCount }).map((_, ci) => (
                <div key={ci} className={getAiCardWrapper(idx)}>
                  <CardComponent
                    card={{ suit: 'spades' as any, rank: 2 as any, id: `${player.id}-${ci}` }}
                    faceDown
                    small
                    animate={false}
                  />
                </div>
              ))}
            </div>
          );
        })}
        {players.map((player, idx) => {
          const badgeStyle = getBadgeStyle(idx);
          const isActive = currentPlayerId === player.id;
          const isHuman = player.id === humanPlayerId;

          return (
            <div
              key={player.id}
              className="absolute flex flex-col items-center gap-1 z-20"
              style={badgeStyle}
            >
              {/* Badge */}
              <div
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap backdrop-blur-sm ${
                  isActive
                    ? 'bg-amber-400/90 text-gray-900 shadow-lg shadow-amber-400/30'
                    : isHuman
                      ? 'bg-blue-500/80 text-white'
                      : 'bg-black/40 text-white/80'
                }`}
              >
                {isHuman ? '你' : player.name}
                {isActive && <span className="ml-1 animate-pulse">●</span>}
              </div>
              <div className="text-white/60 text-xs bg-black/40 px-2 py-0.5 rounded-full">
                {player.score} 分
              </div>
            </div>
          );
        })}

        {/* Trick cards — animated from player's hand area to center */}
        {trick && trick.cards.length > 0 && (
          <div className="absolute inset-0">
            {trick.cards.map((play, idx) => {
              const playerIdx = players.findIndex(p => p.id === play.playerId);
              // Final offset from center for each player's card
              const offset = 24 + idx * 4;
              let positionTransform = `translate(-50%, -50%)`;
              switch (playerIdx) {
                case 0: positionTransform += ` translateY(${offset}px)`; break;
                case 1: positionTransform += ` translateX(${-offset}px)`; break;
                case 2: positionTransform += ` translateY(${-offset}px)`; break;
                case 3: positionTransform += ` translateX(${offset}px)`; break;
              }

              return (
                <motion.div
                  key={`${play.card.id}-${idx}`}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    zIndex: idx,
                  }}
                  initial={{
                    scale: 0.5,
                    opacity: 0,
                    x: playerIdx === 0 ? 0 : playerIdx === 1 ? -100 : playerIdx === 3 ? 100 : 0,
                    y: playerIdx === 0 ? 150 : playerIdx === 1 ? 0 : playerIdx === 2 ? -150 : 0,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    x: playerIdx === 0 ? 0 : playerIdx === 1 ? -offset : playerIdx === 3 ? offset : 0,
                    y: playerIdx === 0 ? offset : playerIdx === 1 ? 0 : playerIdx === 2 ? -offset : 0,
                  }}
                  transition={{
                    duration: 0.6,
                    delay: idx * 0.25,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                >
                  <CardComponent card={play.card} faceDown={false} small />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Empty state hint */}
        {!trick || trick.cards.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-white/10 text-4xl font-bold select-none">
              出牌区
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
});

function getBadgeStyle(idx: number): React.CSSProperties {
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
    case 1: // left — vertical stack outside left edge, offset from badge
      return 'absolute left-[-80px] top-1/2 -translate-y-1/2 flex flex-col z-10';
    case 2: // top — horizontal row outside top edge
      return 'absolute top-[-130px] left-1/2 -translate-x-1/2 flex flex-row z-10';
    case 3: // right — vertical stack outside right edge
      return 'absolute right-[-70px] top-1/2 -translate-y-1/2 flex flex-col z-10';
    default: return '';
  }
}

function getAiCardWrapper(idx: number): string {
  switch (idx) {
    case 1:
    case 3: return 'w-7 h-10 -ml-1'; // vertical stack
    case 2: return 'w-7 h-10 -ml-1'; // horizontal stack
    default: return 'w-7 h-10 -ml-1';
  }
}

function getTrickCardStyle(idx: number): React.CSSProperties {
  // Position cards near the center, offset toward each player's badge
  // Using calc to position relative to center
  switch (idx) {
    case 0: return { bottom: '15%', left: '50%', transform: 'translateX(-50%)' }; // bottom (human)
    case 1: return { left: '15%', top: '50%', transform: 'translateY(-50%)' }; // left
    case 2: return { top: '15%', left: '50%', transform: 'translateX(-50%)' }; // top
    case 3: return { right: '15%', top: '50%', transform: 'translateY(-50%)' }; // right
    default: return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  }
}

Table.displayName = 'Table';

export { Table };
