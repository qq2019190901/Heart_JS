import React, { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CardComponent } from '../Card/Card';
import type { TrickState } from '../../game/types';

interface TableProps {
  trick: TrickState | null;
  currentPlayerId: string;
  humanPlayerId: string;
  players: { id: string; name: string; score: number }[];
}

const Table: React.FC<TableProps> = memo(({ trick, currentPlayerId, humanPlayerId, players }) => {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [isPortrait, setIsPortrait] = useState(true);

  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const tableW = isPortrait
    ? 'min(92vw, 600px)'
    : 'min(75vw, 600px)';
  const tableH = isPortrait
    ? 'min(45vh, 400px)'
    : 'min(35vh, 350px)';

  const badgeOffset = isMobile ? '25px' : '50px';
  const sideBadgeOffset = isMobile ? '15px' : '30px';
  const positions = [
    { bottom: `-${badgeOffset}`, left: '50%', x: -50, unit: '%' as const },
    { right: `-${sideBadgeOffset}`, top: '50%', y: -50, unit: '%' as const },
    { top: `-${badgeOffset}`, left: '50%', x: -50, unit: '%' as const },
    { left: `-${sideBadgeOffset}`, top: '50%', y: -50, unit: '%' as const },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <motion.div
        className="relative rounded-2xl border-[6px] sm:border-8 border-amber-900/60 shadow-2xl"
        style={{
          width: tableW,
          height: tableH,
          background: 'radial-gradient(ellipse at center, #1a7a3a 0%, #0d5e28 60%, #094a20 100%)',
          willChange: 'transform',
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Texture overlay */}
        <div
          className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'6\' height=\'6\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'0.5\' fill=\'white\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Trick cards */}
        <div className="absolute inset-4 sm:inset-8 flex items-center justify-center">
          {trick?.cards.map((play, idx) => {
            // Find player index to determine card position
            const playerIdx = players.findIndex(p => p.id === play.playerId);
            // Position mapping: 0=bottom, 1=right, 2=top, 3=left
            const positions = [
              { bottom: '15%', left: '50%', x: -50, y: 0 },
              { right: '15%', top: '50%', x: 0, y: -50 },
              { top: '15%', left: '50%', x: -50, y: 0 },
              { left: '15%', top: '50%', x: 0, y: -50 },
            ];
            const pos = positions[playerIdx % positions.length];
            const posStyle: React.CSSProperties = {};
            if ('bottom' in pos) { posStyle.bottom = pos.bottom; posStyle.left = pos.left; posStyle.transform = `translate(${pos.x}%, ${pos.y}%)`; }
            if ('right' in pos) { posStyle.right = pos.right; posStyle.top = pos.top; posStyle.transform = `translate(${pos.x}%, ${pos.y}%)`; }
            if ('top' in pos && !('right' in pos)) { posStyle.top = pos.top; posStyle.left = pos.left; posStyle.transform = `translate(${pos.x}%, ${pos.y}%)`; }
            if ('left' in pos && !('top' in pos && 'right' in pos)) { posStyle.left = pos.left; posStyle.top = pos.top; posStyle.transform = `translate(${pos.x}%, ${pos.y}%)`; }

            return (
              <motion.div
                key={`${play.card.id}-${idx}`}
                className="absolute"
                style={posStyle}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <CardComponent card={play.card} faceDown={false} small />
              </motion.div>
            );
          })}
        </div>

        {/* Player indicators */}
        {players.map((player, idx) => {
          const pos = positions[idx % positions.length];
          const isActive = currentPlayerId === player.id;
          const isHuman = player.id === humanPlayerId;

          const posStyle: React.CSSProperties = {
            zIndex: 20,
          };
          if ('bottom' in pos) { posStyle.bottom = pos.bottom; posStyle.left = pos.left; posStyle.transform = `translateX(${pos.x}${pos.unit})`; }
          if ('right' in pos) { posStyle.right = pos.right; posStyle.top = pos.top; posStyle.transform = `translateY(${pos.y}${pos.unit})`; }
          if ('top' in pos && !('right' in pos)) { posStyle.top = pos.top; posStyle.left = pos.left; posStyle.transform = `translateX(${pos.x}${pos.unit})`; }
          if ('left' in pos && !('top' in pos && 'right' in pos)) { /* already handled */ }

          return (
            <motion.div
              key={player.id}
              className="absolute flex flex-col items-center gap-0.5"
              style={posStyle}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.1 }}
            >
              <div
                className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap backdrop-blur-sm ${
                  isActive
                    ? 'bg-yellow-400/90 text-gray-900'
                    : isHuman
                      ? 'bg-blue-500/80 text-white'
                      : 'bg-black/40 text-white/80'
                }`}
              >
                {isHuman ? '你' : player.name}
              </div>
              <div className="text-white/50 text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full">
                {player.score}分
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
});

Table.displayName = 'Table';

export { Table };
