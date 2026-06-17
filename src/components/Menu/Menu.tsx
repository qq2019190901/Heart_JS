import React, { useState, memo } from 'react';
import { motion } from 'framer-motion';

interface MenuProps {
  onStartSingle: () => void;
  onStartMulti: () => void;
  onStartLocal: () => void;
}

const Menu: React.FC<MenuProps> = memo(({ onStartSingle, onStartMulti, onStartLocal }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0d5e28 0%, #1a7a3a 30%, #0d5e28 70%, #094a20 100%)',
      }}>
      {/* Floating suit symbols */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-white/[0.08] select-none pointer-events-none"
          style={{
            left: `${15 + i * 15}%`,
            top: `${10 + (i % 3) * 25}%`,
            fontSize: '3rem',
          }}
          animate={{
            y: [0, -15, 0],
            rotate: [0, 5, -5, 0],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.3,
          }}
        >
          {['\u2665', '\u2666', '\u2663', '\u2660', '\u2665', '\u2666'][i]}
        </motion.div>
      ))}

      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="text-center mb-8 sm:mb-12 z-10 px-4"
      >
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white tracking-wide"
          style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          红心大战
        </h1>
        <p className="text-white/50 text-sm sm:text-lg md:text-xl tracking-widest mt-1">HEARTS</p>
      </motion.div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 w-56 sm:w-64 z-10 px-4">
        <MenuButton label="单人游戏" sub="与AI对战" onClick={onStartSingle} delay={0.2} />
        <MenuButton label="局域网联机" sub="本地多人对战" onClick={onStartLocal} delay={0.4} />
        <MenuButton label="在线联机" sub="WebSocket联机" onClick={onStartMulti} delay={0.6} />
      </div>

      {/* Rules toggle */}
      <motion.button
        className="mt-6 sm:mt-12 text-white/40 text-xs sm:text-sm hover:text-white/70 transition-colors z-10"
        onClick={() => setMenuOpen(!menuOpen)}
        whileHover={{ scale: 1.05 }}
      >
        {menuOpen ? '收起规则 ▲' : '游戏规则 ▼'}
      </motion.button>

      {menuOpen && (
        <motion.div
          className="mt-3 mx-4 p-4 rounded-xl max-w-sm z-10 text-white/70 text-xs sm:text-sm leading-relaxed"
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-white font-bold mb-1.5">游戏规则</h3>
          <ul className="list-disc list-inside space-y-0.5">
            <li>4人游戏，每人13张牌</li>
            <li>轮流出牌，每人出一张，13轮后结算</li>
            <li>最小牌先出（♣2）</li>
            <li>必须跟牌，无牌可跟可出任意牌</li>
            <li>每轮最高花色牌者赢墩</li>
            <li>每张♥1分，♠Q 13分</li>
            <li>有人先到100分游戏结束，分少者胜</li>
            <li>包揽所有♥+♠Q = "一枪不响"，其他人0分</li>
          </ul>
        </motion.div>
      )}
    </div>
  );
});

Menu.displayName = 'Menu';

interface MenuButtonProps {
  label: string;
  sub: string;
  onClick: () => void;
  delay: number;
}

const MenuButton: React.FC<MenuButtonProps> = memo(({ label, sub, onClick, delay }) => (
  <motion.button
    className="px-6 py-3 rounded-xl text-white font-semibold text-base sm:text-lg tracking-wide transition-all whitespace-nowrap"
    style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
      border: '1px solid rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    }}
    onClick={onClick}
    initial={{ opacity: 0, x: -30 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{ scale: 1.03, background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)' }}
    whileTap={{ scale: 0.97 }}
  >
    <div>{label}</div>
    <div className="text-[10px] sm:text-xs text-white/40 font-normal">{sub}</div>
  </motion.button>
));

MenuButton.displayName = 'MenuButton';

export { Menu };
