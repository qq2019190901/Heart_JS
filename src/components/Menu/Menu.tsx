import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { LanPeerManager } from '../../network/lan-peer';

interface MenuProps {
  onStartSingle: () => void;
  onStartLanHost: (roomId: string) => void;
  onStartLanJoin: (roomCode: string) => void;
  onStartLocal: () => void;
}

const Menu: React.FC<MenuProps> = memo(({
  onStartSingle,
  onStartLanHost,
  onStartLanJoin,
  onStartLocal,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLanPanel, setShowLanPanel] = useState(false);

  // Server config
  const [serverHost, setServerHost] = useState('127.0.0.1');
  const [serverPort, setServerPort] = useState('9000');

  // Create room
  const [createRoomCode, setCreateRoomCode] = useState('');

  // Join room (LAN)
  const [joinRoomCode, setJoinRoomCode] = useState('6666');

  // Responsive sizing
  const [minDim, setMinDim] = useState(Math.min(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const handleResize = () => setMinDim(Math.min(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isPhone = minDim < 450;
  const isTablet = minDim >= 450 && minDim < 768;

  const btnSizeClass = isPhone ? 'py-2 text-sm' : isTablet ? 'py-2.5 text-sm sm:text-base' : 'py-3 text-base sm:text-lg';
  const btnSubSize = isPhone ? 'text-[9px]' : 'text-[10px] sm:text-xs';
  const titleSize = isPhone ? 'text-2xl sm:text-3xl' : isTablet ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-4xl sm:text-5xl md:text-7xl';
  const subtitleSize = isPhone ? 'text-[9px]' : isTablet ? 'text-xs sm:text-sm' : 'text-sm sm:text-lg md:text-xl';
  const buttonWidth = isPhone ? 'w-44 sm:w-52' : 'w-52 sm:w-64';
  const lanPanelWidth = isPhone ? 'w-64 sm:w-72' : 'w-72 sm:w-80';
  const inputSize = isPhone ? 'text-xs py-1.5 px-2' : isTablet ? 'text-sm py-2 px-3' : 'text-sm py-2 px-3';
  const labelSize = isPhone ? 'text-[9px]' : 'text-xs';

  const handleJoin = () => {
    if (joinRoomCode.trim().length >= 3) {
      onStartLanJoin(joinRoomCode.trim().toUpperCase());
    }
  };

  const handleCreate = () => {
    const code = createRoomCode.trim().toUpperCase() || LanPeerManager.generateRoomCode();
    onStartLanHost(code);
  };

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
            fontSize: isPhone ? '1.5rem' : isTablet ? '2rem' : '3rem',
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
          {['♥', '♦', '♣', '♠', '♥', '♦'][i]}
        </motion.div>
      ))}

      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="text-center mb-4 sm:mb-6 px-4 z-10"
      >
        <h1 className={titleSize} style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          红心大战
        </h1>
        <p className={`${subtitleSize} text-white/50 tracking-widest mt-1`}>HEARTS</p>
      </motion.div>

      {/* Buttons */}
      <div className={`flex flex-col gap-2 sm:gap-3 ${buttonWidth} z-10 px-4`}>
        <MenuButton label="单人游戏" sub="与AI对战" onClick={onStartSingle} delay={0.2} btnSize={btnSizeClass} subSize={btnSubSize} />
        <MenuButton label="局域网联机" sub="" onClick={() => setShowLanPanel(!showLanPanel)} delay={0.4} btnSize={btnSizeClass} subSize={btnSubSize} />
      </div>

      {/* LAN Panel */}
      {showLanPanel && (
        <motion.div
          className={`z-20 mt-3 sm:mt-4 ${lanPanelWidth} rounded-xl p-3 sm:p-4`}
          style={{
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className={`text-white font-bold text-center mb-2 sm:mb-3 ${isVeryCompact ? 'text-sm' : 'text-base'}`}>局域网联机</h3>

          {/* Server Config */}
          <div className="mb-2 sm:mb-3">
            <label className={`${labelSize} text-white/60 block mb-1 text-center`}>PeerJS 服务器</label>
            <div className="flex gap-1.5 sm:gap-2">
              <input
                type="text"
                value={serverHost}
                onChange={(e) => setServerHost(e.target.value)}
                placeholder="IP 地址"
                className={`flex-1 rounded-lg text-white font-mono ${inputSize}`}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="端口"
                className={`w-16 sm:w-20 rounded-lg text-white font-mono ${inputSize}`}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Create Room */}
          <div className="mb-2 sm:mb-3">
            <label className={`${labelSize} text-white/60 block mb-1 text-center`}>创建房间</label>
            <div className="flex gap-1.5 sm:gap-2">
              <input
                type="text"
                value={createRoomCode}
                onChange={(e) => setCreateRoomCode(e.target.value.toUpperCase().slice(0, 12))}
                placeholder="房间号（留空自动生成）"
                className={`flex-1 rounded-lg text-white tracking-widest font-mono ${inputSize}`}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  outline: 'none',
                }}
                maxLength={12}
              />
              <button
                className={`px-3 sm:px-4 rounded-lg text-white font-semibold transition-all ${isVeryCompact ? 'text-xs py-1.5' : 'text-sm py-2'}`}
                style={{
                  background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                  boxShadow: '0 2px 10px rgba(46,204,113,0.3)',
                }}
                onClick={handleCreate}
              >
                创建
              </button>
            </div>
          </div>

          {/* Join Room */}
          <div className="flex gap-1.5 sm:gap-2">
            <input
              type="text"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase().slice(0, 12))}
              placeholder="房间号"
              className={`flex-1 rounded-lg text-white tracking-widest font-mono ${inputSize}`}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                outline: 'none',
              }}
              maxLength={12}
            />
            <button
              className={`px-3 sm:px-4 rounded-lg text-white font-semibold transition-all ${isVeryCompact ? 'text-xs py-1.5' : 'text-sm py-2'}`}
              style={{
                background: 'linear-gradient(135deg, #3498db, #2980b9)',
                boxShadow: '0 2px 10px rgba(52,152,219,0.3)',
              }}
              onClick={handleJoin}
              disabled={joinRoomCode.length < 3}
            >
              加入
            </button>
          </div>
        </motion.div>
      )}

      {/* Rules toggle */}
      <motion.button
        className={`mt-2 sm:mt-4 text-white/40 hover:text-white/70 transition-colors z-10 ${isPhone ? 'text-[9px]' : isTablet ? 'text-xs' : 'text-xs sm:text-sm'}`}
        onClick={() => setMenuOpen(!menuOpen)}
        whileHover={{ scale: 1.05 }}
      >
        {menuOpen ? '收起规则 ▲' : '游戏规则 ▼'}
      </motion.button>

      {menuOpen && (
        <motion.div
          className={`mt-2 sm:mt-3 mx-3 sm:mx-4 p-3 sm:p-4 rounded-xl max-w-sm z-10 ${isPhone ? 'text-[9px]' : isTablet ? 'text-xs' : 'text-xs sm:text-sm'} leading-relaxed text-white/70`}
          style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-white font-bold mb-1">游戏规则</h3>
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
  btnSize: string;
  subSize: string;
}

const MenuButton: React.FC<MenuButtonProps> = memo(({ label, sub, onClick, delay, btnSize, subSize }) => (
  <motion.button
    className={`px-4 sm:px-6 rounded-xl text-white font-semibold tracking-wide transition-all whitespace-nowrap ${btnSize}`}
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
    {sub && <div className={subSize}>{sub}</div>}
  </motion.button>
));

MenuButton.displayName = 'MenuButton';

export { Menu };
