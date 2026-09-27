# Heart_JS — 项目长期记忆

## 项目定位
红心大战（Hearts）纸牌游戏，多端：Web / Electron 桌面 / Capacitor Android。
支持单人（3 档 AI）与局域网联机（PeerJS + 自写信令服务器）。

## 技术栈（版本以 package.json 为准）
- React 19 + TypeScript 6 + Vite 8（无路由，由 `mode` + `gameState.phase` 状态机驱动屏幕切换）
- Vitest 4（jsdom），`react-dom/client` + `act()` 手写 hook 测试 —— **项目未安装 `@testing-library/react`**，
  新测试请沿用 `src/__tests__/test-renderer.ts` 的最小工具
- Electron 43 + 自写信令服务器 `electron/peer-server.ts`（PeerJS 兼容）
- Capacitor 8 打 Android，Java 原生桥接经 `window.AndroidBridge` / `window.__localIp` / `window.__serverPort`
- Tailwind CSS 4（`@tailwindcss/vite`）、Framer Motion 12
- 主题系统：`classic`（绿毛毡）/ `modern`（暗紫），CSS 变量驱动

## 目录约定
- `src/game/` — 纯逻辑（牌堆、规则、状态机、AI），无 React 依赖，最适合写测试
- `src/network/` — 联机。`protocol.ts` 是线协议类型的唯一来源，新增消息类型请加在这里
- `src/components/` — 展示层，`Table/` 负责牌桌布局
- `src/hooks/useResponsive.ts` — 响应式缩放核心，基于 `window.visualViewport`
- `src/env.d.ts` — 原生桥接契约声明，**禁止再写 `window as any`**

## 约定与注意事项
- **红心规则要点**：4 人各 13 张；♥ 每张 1 分、♠Q 13 分；先到 100 分结束；
  代码中 Shoot the Moon 叫 `isShotGunTheRose`（"一枪不响"）
- **共享牌面常量统一走 `src/game/deck.ts`**：`TWO_OF_CLUBS`、`QUEEN_OF_SPADES`、
  `cardId()`、`isTwoOfClubs()`、`isQueenOfSpades()`、`cardPoints()`、`countPoints()`。
  **不要再写字面量 `rank === 12` 或字符串拼接 `` `${suit}-${rank}` ``**
- **跑检查用 `npm run check`**（= `scripts/run-checks.mjs all`）。
  本机 shell 环境损坏（`ls`/`dirname`/`head` 均 127，`cd` 失败），
  **必须用 Node 直调工具链**，不要依赖裸 shell 命令
- 中国大陆股票/金融配色约定不适用于本项目（这是游戏，不是金融）
- 提交前确保：`npm run check` 4/4 通过（前端 tsc、Electron tsc、vitest、eslint 0 error）

## 已知的刻意设计
- AI 回合 effect 的依赖数组**刻意不包含整个 `gameState`**，只用
  `currentPlayerId` / `phase` / `trickJustCompleted` 三个原语。
  这是为避免每次状态对象变化都重启 AI 计时器。改动前请先读懂代码内注释。
- 联机时**只有房主驱动 AI 回合**（`lanIsHostRef.current` 判断），客户端只做展示与上行。
