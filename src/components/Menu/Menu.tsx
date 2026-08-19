import React, { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { LanPeerManager, type ServerMode } from '../../network/lan-peer';

interface MenuProps {
  onStartSingle: () => void;
  onStartLanHost: (roomId: string) => void;
  onStartLanJoin: (roomCode: string, serverHost: string, serverPort: string) => void;
  theme?: 'classic' | 'modern';
  onThemeChange?: (theme: 'classic' | 'modern') => void;
}

const Menu: React.FC<MenuProps> = memo(({
  onStartSingle,
  onStartLanHost,
  onStartLanJoin,
  theme = 'classic',
  onThemeChange,
}) => {
  const [buildVersion, setBuildVersion] = useState('');

  useEffect(() => {
    fetch('./version.txt').then(r => r.text()).then(t => setBuildVersion(t.trim())).catch(() => {});
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLanPanel, setShowLanPanel] = useState(false);
  const [serverMode, setServerMode] = useState<ServerMode>(() => {
    const urlServer = LanPeerManager.getServerFromUrl();
    const savedServer = LanPeerManager.getSavedServer();
    if (urlServer) return 'custom';
    if (savedServer && savedServer.host !== '127.0.0.1') return 'custom';
    return 'embedded';
  });

  // Server config (only used in custom mode)
  const [serverHost, setServerHost] = useState(() => {
    const urlServer = LanPeerManager.getServerFromUrl();
    if (urlServer) return urlServer.host;
    return '127.0.0.1';
  });
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

  // Theme-aware colors for LAN panel
  const lanIsClassic = theme === 'classic';
  const lanPanelBg = lanIsClassic
    ? 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.92) 100%)'
    : 'linear-gradient(135deg, rgba(18,18,30,0.9) 0%, rgba(26,26,46,0.9) 100%)';
  const lanPanelBorder = lanIsClassic ? 'rgba(0,0,0,0.12)' : 'rgba(139,92,246,0.2)' ;
  const lanPanelShadow = lanIsClassic
    ? '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)'
    : '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)';
  const lanColor = lanIsClassic ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)' ;
  const lanColorMuted = lanIsClassic ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' ;
  const lanColorSubtle = lanIsClassic ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)' ;
  const lanInputBg = lanIsClassic ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)' ;
  const lanInputBorder = lanIsClassic ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)' ;

  const inputSize = isPhone ? 'text-xs py-1.5 px-2' : isTablet ? 'text-sm py-2 px-3' : 'text-sm py-2 px-3';
  const labelSize = isPhone ? 'text-[9px]' : 'text-xs';

  const handleJoin = () => {
    if (joinRoomCode.trim().length >= 3) {
      onStartLanJoin(joinRoomCode.trim().toUpperCase(), serverHost, serverPort);
    }
  };

  const handleCreate = () => {
    const code = createRoomCode.trim().toUpperCase() || LanPeerManager.generateRoomCode();
    onStartLanHost(code);
  };

  const handleServerModeChange = (mode: ServerMode) => {
    setServerMode(mode);
    LanPeerManager.getInstance().setServerMode(mode);
    if (mode === 'embedded') {
      setServerHost('127.0.0.1');
      LanPeerManager.getInstance().setServerConfig({ host: '127.0.0.1', port: 9000 });
    }
  };

  return (
    <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center relative overflow-visible"
      style={{
        background: theme === 'modern'
          ? 'linear-gradient(160deg, #0a0a0f 0%, #12121c 40%, #1a1a2e 100%)'
          : 'linear-gradient(160deg, #0d5e28 0%, #1a8a4a 50%, #094a20 100%)',
      }}>
      {/* Ambient glow */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none select-none"
        style={{
          background: `radial-gradient(circle, var(--menu-glow-1, rgba(139,92,246,0.08)) 0%, transparent 70%)`,
        }}
      />
      <div className="absolute bottom-[10%] left-0 w-[300px] h-[300px] rounded-full pointer-events-none select-none"
        style={{
          background: `radial-gradient(circle, var(--menu-glow-2, rgba(239,68,68,0.06)) 0%, transparent 70%)`,
        }}
      />
      <div className="absolute bottom-[5%] right-0 w-[250px] h-[250px] rounded-full pointer-events-none select-none"
        style={{
          background: `radial-gradient(circle, var(--menu-glow-3, rgba(59,130,246,0.06)) 0%, transparent 70%)`,
        }}
      />

      {/* Floating suit symbols */}
      {[...Array(8)].map((_, i) => {
        const suits = ['♥', '♦', '♣', '♠', '♥', '♦', '♣', '♠'];
        return (
          <motion.div
            key={i}
            className="absolute select-none pointer-events-none"
            style={{
              left: `${8 + i * 13}%`,
              top: `${8 + (i % 4) * 24}%`,
              fontSize: isPhone ? '1.2rem' : isTablet ? '1.8rem' : '2.5rem',
              opacity: 0.04,
              color: 'white',
            }}
            animate={{
              y: [0, -12, 0],
              rotate: [0, 8, -8, 0],
              opacity: [0.04, 0.1, 0.04],
            }}
            transition={{
              duration: 5 + i * 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.25,
            }}
          >
            {suits[i]}
          </motion.div>
        );
      })}

      {/* Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring' }}
        className="text-center mb-5 sm:mb-7 px-4 z-10"
      >
        {/* Card suit icon */}
        <div className="flex justify-center mb-2">
          <motion.div
            className="text-3xl sm:text-4xl md:text-5xl"
            style={{ filter: 'drop-shadow(0 0 12px rgba(239,68,68,0.5))' }}
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            ♥
          </motion.div>
        </div>
        <h1 className={titleSize} style={{
          textShadow: '0 0 40px var(--menu-glow-1, rgba(139,92,246,0.3)), 0 2px 10px rgba(0,0,0,0.8)',
          background: 'var(--menu-title-grad, linear-gradient(135deg, #fff 0%, #c4b5fd 50%, #f9a8d4 100%))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          红心大战
        </h1>
        <p className={`${subtitleSize} tracking-[0.3em] mt-1.5 uppercase`}
          style={{ color: theme === 'modern' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)' }}>
          HEARTS · CARD GAME
        </p>
      </motion.div>

      {/* Buttons */}
      <div className={`flex flex-col gap-2.5 sm:gap-3 ${buttonWidth} z-10 px-4`}>
        <MenuButton
          label="单人游戏"
          sub="与AI对战"
          icon="🤖"
          onClick={onStartSingle}
          delay={0.2}
          btnSize={btnSizeClass}
          subSize={btnSubSize}
          accent="violet"
        />
        <MenuButton
          label="局域网联机"
          sub=""
          icon="🌐"
          onClick={() => setShowLanPanel(!showLanPanel)}
          delay={0.4}
          btnSize={btnSizeClass}
          subSize={btnSubSize}
          accent="blue"
        />
      </div>

      {/* Theme toggle button — top-right corner, icon only */}
      <button
        className="fixed top-4 right-4 z-30 w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all active:scale-90"
        style={{
          background: theme === 'modern'
            ? 'rgba(139,92,246,0.35)'
            : 'rgba(0,0,0,0.5)',
          border: theme === 'modern'
            ? '1px solid rgba(139,92,246,0.6)'
            : '1px solid rgba(255,255,255,0.6)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={() => onThemeChange?.(theme === 'classic' ? 'modern' : 'classic')}
        aria-label="切换主题"
      >
        {theme === 'classic' ? '🌙' : '🟢'}
      </button>

      {/* Build version — bottom center */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] select-none"
        style={{ color: theme === 'modern' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.5)' }}
      >
        v{buildVersion || 'unknown'}
      </div>

      {/* LAN Panel */}
      {showLanPanel && (
        <motion.div
          className={`z-20 mt-3 sm:mt-4 ${lanPanelWidth} rounded-xl p-3 sm:p-4`}
          style={{
            background: lanPanelBg,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${lanPanelBorder}`,
            boxShadow: lanPanelShadow,
          }}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className={`font-bold text-center mb-2 sm:mb-3 ${isPhone ? 'text-sm' : 'text-base'}`} style={{ color: lanColor }}>局域网联机</h3>

          {/* Server Mode Selector */}
          <div className="mb-2 sm:mb-3">
            <label className={`${labelSize} block mb-1 text-center`} style={{ color: lanColorMuted }}>连接模式</label>
            <div className="flex gap-1.5 sm:gap-2">
              {(['embedded', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleServerModeChange(mode)}
                  className={`flex-1 rounded-lg text-xs font-medium transition-all ${isPhone ? 'py-1.5' : 'py-2'}`}
                  style={{
                    background: serverMode === mode
                      ? 'linear-gradient(135deg, var(--accent, #2ecc71), var(--accent-dark, #27ae60))'
                      : lanInputBg,
                    color: serverMode === mode ? '#fff' : lanColorMuted,
                  }}
                >
                  {mode === 'embedded' ? '我来当房主' : '加入别人房间'}
                </button>
              ))}
            </div>
            <p className={`text-center mt-1 ${isPhone ? 'text-[8px]' : 'text-[10px]'}`} style={{ color: lanColorSubtle }}>
              {serverMode === 'embedded' ? '自动启动服务器，等待他人加入' : '输入他人的房间号或 IP 加入'}
            </p>
          </div>

          {/* Server Config (custom mode only) */}
          {serverMode === 'custom' && (
            <div className="mb-2 sm:mb-3">
              <label className={`${labelSize} block mb-1 text-center`} style={{ color: lanColorMuted }}>PeerJS 服务器</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  placeholder="IP 地址"
                  className={`flex-1 rounded-lg font-mono ${inputSize}`}
                  style={{
                    background: lanInputBg,
                    border: `1px solid ${lanInputBorder}`,
                    outline: 'none',
                    color: lanColor,
                  }}
                />
                <input
                  type="text"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="端口"
                  className={`w-16 sm:w-20 rounded-lg font-mono ${inputSize}`}
                  style={{
                    background: lanInputBg,
                    border: `1px solid ${lanInputBorder}`,
                    outline: 'none',
                    color: lanColor,
                  }}
                />
              </div>
            </div>
          )}

          {/* Create Room (host mode only) */}
          {serverMode === 'embedded' && (
            <div className="mb-2 sm:mb-3">
              <label className={`${labelSize} block mb-1 text-center`} style={{ color: lanColorMuted }}>创建房间</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={createRoomCode}
                  onChange={(e) => setCreateRoomCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="房间号（留空自动生成）"
                  className={`flex-1 rounded-lg tracking-widest font-mono ${inputSize}`}
                  style={{
                    background: lanInputBg,
                    border: `1px solid ${lanInputBorder}`,
                    outline: 'none',
                    color: lanColor,
                  }}
                  maxLength={12}
                />
                <button
                  className={`px-3 sm:px-4 rounded-lg font-semibold transition-all ${isPhone ? 'text-xs py-1.5' : 'text-sm py-2'}`}
                  style={{
                    background: lanIsClassic
                      ? 'linear-gradient(135deg, #2ecc71, #27ae60)'
                      : 'linear-gradient(135deg, var(--accent, #2ecc71), var(--accent-dark, #27ae60))',
                    boxShadow: lanIsClassic
                      ? '0 2px 10px rgba(46,204,113,0.3)'
                      : '0 2px 10px var(--accent-glow, rgba(46,204,113,0.3))',
                    color: '#fff',
                  }}
                  onClick={handleCreate}
                >
                  创建
                </button>
              </div>
            </div>
          )}

          {/* Join Room (client mode only) */}
          {serverMode === 'custom' && (
            <div className="mb-2 sm:mb-3">
              <label className={`${labelSize} block mb-1 text-center`} style={{ color: lanColorMuted }}>加入房间</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="房间号"
                  className={`flex-1 rounded-lg tracking-widest font-mono ${inputSize}`}
                  style={{
                    background: lanInputBg,
                    border: `1px solid ${lanInputBorder}`,
                    outline: 'none',
                    color: lanColor,
                  }}
                  maxLength={12}
                />
                <button
                  className={`px-3 sm:px-4 rounded-lg font-semibold transition-all ${isPhone ? 'text-xs py-1.5' : 'text-sm py-2'}`}
                  style={{
                    background: lanIsClassic
                      ? 'linear-gradient(135deg, #3498db, #2980b9)'
                      : 'linear-gradient(135deg, var(--accent, #3498db), var(--accent-dark, #2980b9))',
                    boxShadow: lanIsClassic
                      ? '0 2px 10px rgba(52,152,219,0.3)'
                      : '0 2px 10px var(--accent-glow, rgba(52,152,219,0.3))',
                    color: '#fff',
                    opacity: joinRoomCode.length < 3 ? 0.5 : 1,
                  }}
                  onClick={handleJoin}
                  disabled={joinRoomCode.length < 3}
                >
                  加入
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Exit button — Electron only */}
      {(typeof (window as any).electronAPI !== 'undefined') && (
        <motion.button
          className={`mt-3 text-white/40 hover:text-red-400 transition-colors z-10 ${isPhone ? 'text-[9px]' : isTablet ? 'text-xs' : 'text-xs sm:text-sm'}`}
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).electronAPI?.exit();
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          whileTap={{ scale: 0.97 }}
        >
          退出游戏
        </motion.button>
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
          className={`mt-2 sm:mt-3 mx-3 sm:mx-4 p-3 sm:p-4 rounded-xl max-w-sm z-10 ${isPhone ? 'text-[9px]' : isTablet ? 'text-xs' : 'text-xs sm:text-sm'} leading-relaxed`}
          style={{
            background: 'var(--menu-panel-bg, rgba(0,0,0,0.3))',
            backdropFilter: 'blur(10px)',
            color: 'var(--menu-text-primary, rgba(255,255,255,0.7))',
          }}
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
  icon: string;
  onClick: () => void;
  delay: number;
  btnSize: string;
  subSize: string;
  accent?: 'violet' | 'blue';
}

const accentBorders: Record<string, string> = {
  violet: 'var(--menu-btn-border, rgba(139,92,246,0.4))',
  blue: 'var(--menu-btn-border, rgba(59,130,246,0.4))',
};
const accentShadows: Record<string, string> = {
  violet: 'var(--accent-glow, rgba(139,92,246,0.25))',
  blue: 'var(--accent-glow, rgba(59,130,246,0.25))',
};

const MenuButton: React.FC<MenuButtonProps> = memo(({ label, sub, icon, onClick, delay, btnSize, subSize, accent = 'violet' }) => (
  <motion.button
    className={`w-full px-4 sm:px-6 rounded-xl text-white font-semibold tracking-wide transition-all flex items-center gap-3 ${btnSize}`}
    style={{
      background: 'var(--menu-btn-bg, linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%))',
      border: `1px solid var(--menu-btn-border, ${accentBorders[accent]})`,
      backdropFilter: 'blur(10px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}
    onClick={onClick}
    initial={{ opacity: 0, x: -30 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    whileHover={{
      scale: 1.02,
      background: 'var(--menu-btn-hover-bg, linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%))',
      boxShadow: `0 6px 25px rgba(0,0,0,0.4), 0 0 20px var(--accent-glow, ${accentShadows[accent]})`,
    }}
    whileTap={{ scale: 0.97 }}
  >
    <span className="text-xl sm:text-2xl select-none">{icon}</span>
    <div className="text-left flex-1">
      <div>{label}</div>
      {sub && <div className={subSize + ' text-white/40'}>{sub}</div>}
    </div>
    <span className="text-white/20 text-lg select-none">›</span>
  </motion.button>
));

MenuButton.displayName = 'MenuButton';

export { Menu };
