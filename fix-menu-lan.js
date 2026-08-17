const fs = require('fs');
let content = fs.readFileSync('src/components/Menu/Menu.tsx', 'utf8');

// Replace the entire LAN panel section
const lanStart = content.indexOf('{showLanPanel && (');
const lanEndMarker = '\n      )}\n\n      {/* Exit button';
const lanEnd = content.indexOf(lanEndMarker);

if (lanStart === -1 || lanEnd === -1) {
  console.log('Could not find boundaries');
  process.exit(1);
}

const newLanPanel = `{showLanPanel && (
        <motion.div
          className={\`z-20 mt-3 sm:mt-4 \${lanPanelWidth} rounded-xl p-3 sm:p-4\`}
          style={{
            background: lanPanelBg,
            backdropFilter: 'blur(12px)',
            border: \`1px solid \${lanPanelBorder}\`,
            boxShadow: lanPanelShadow,
          }}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className={\`font-bold text-center mb-2 sm:mb-3 \${isPhone ? 'text-sm' : 'text-base'}\`} style={{ color: lanColor }}>局域网联机</h3>

          {/* Server Mode Selector */}
          <div className="mb-2 sm:mb-3">
            <label className={\`\${labelSize} block mb-1 text-center\`} style={{ color: lanColorMuted }}>连接模式</label>
            <div className="flex gap-1.5 sm:gap-2">
              {(['embedded', 'custom'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleServerModeChange(mode)}
                  className={\`flex-1 rounded-lg text-xs font-medium transition-all \${isPhone ? 'py-1.5' : 'py-2'}\`}
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
            <p className={\`text-center mt-1 \${isPhone ? 'text-[8px]' : 'text-[10px]'}\`} style={{ color: lanColorSubtle }}>
              {serverMode === 'embedded' ? '自动启动服务器，等待他人加入' : '输入他人的房间号或 IP 加入'}
            </p>
          </div>

          {/* Server Config (custom mode only) */}
          {serverMode === 'custom' && (
            <div className="mb-2 sm:mb-3">
              <label className={\`\${labelSize} block mb-1 text-center\`} style={{ color: lanColorMuted }}>PeerJS 服务器</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={serverHost}
                  onChange={(e) => setServerHost(e.target.value)}
                  placeholder="IP 地址"
                  className={\`flex-1 rounded-lg font-mono \${inputSize}\`}
                  style={{
                    background: lanInputBg,
                    border: \`1px solid \${lanInputBorder}\`,
                    outline: 'none',
                    color: lanColor,
                  }}
                />
                <input
                  type="text"
                  value={serverPort}
                  onChange={(e) => setServerPort(e.target.value.replace(/\\D/g, '').slice(0, 5))}
                  placeholder="端口"
                  className={\`w-16 sm:w-20 rounded-lg font-mono \${inputSize}\`}
                  style={{
                    background: lanInputBg,
                    border: \`1px solid \${lanInputBorder}\`,
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
              <label className={\`\${labelSize} block mb-1 text-center\`} style={{ color: lanColorMuted }}>创建房间</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={createRoomCode}
                  onChange={(e) => setCreateRoomCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="房间号（留空自动生成）"
                  className={\`flex-1 rounded-lg tracking-widest font-mono \${inputSize}\`}
                  style={{
                    background: lanInputBg,
                    border: \`1px solid \${lanInputBorder}\`,
                    outline: 'none',
                    color: lanColor,
                  }}
                  maxLength={12}
                />
                <button
                  className={\`px-3 sm:px-4 rounded-lg font-semibold transition-all \${isPhone ? 'text-xs py-1.5' : 'text-sm py-2'}\`}
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
              <label className={\`\${labelSize} block mb-1 text-center\`} style={{ color: lanColorMuted }}>加入房间</label>
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="房间号"
                  className={\`flex-1 rounded-lg tracking-widest font-mono \${inputSize}\`}
                  style={{
                    background: lanInputBg,
                    border: \`1px solid \${lanInputBorder}\`,
                    outline: 'none',
                    color: lanColor,
                  }}
                  maxLength={12}
                />
                <button
                  className={\`px-3 sm:px-4 rounded-lg font-semibold transition-all \${isPhone ? 'text-xs py-1.5' : 'text-sm py-2'}\`}
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
      )}`;

content = content.substring(0, lanStart) + newLanPanel + content.substring(lanEnd);
fs.writeFileSync('src/components/Menu/Menu.tsx', content);
console.log('LAN panel replaced successfully');
