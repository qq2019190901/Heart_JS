# Heart_JS — 工作区长期记忆（AI 侧）

## 权威项目记忆在仓库里
本项目自带 `.workbuddy/memory/`（已提交进 git），是**项目约定的唯一权威来源**：
- `.workbuddy/memory/MEMORY.md` — 技术栈、目录约定、规则要点、刻意设计
- `.workbuddy/memory/YYYY-MM-DD.md` — 逐日工作日志

**开工前先读它们。** 本文件只记录 AI 侧的操作性知识，不重复其内容。

## 本机网络约定（重要）
- **github.com 直连不通**（443 超时）。GitHub 相关操作走镜像 `https://ghfast.top/`：
  `git clone https://ghfast.top/https://github.com/<owner>/<repo>.git`
- 仓库 remote：`origin` = ghfast 镜像（可用）；`github` = 原始地址（备用，暂不可达）
- npm 源已在仓库 `.npmrc` 里配好 npmmirror，无需手动改

## git 提交身份（必须显式指定）
仓库 `.git/config` 和全局都**没有** `user.*`，直接 `git commit` 会失败/用错身份。
历史提交统一是 `Claude Code <claude@anthropic.com>`，保持它以免历史割裂：
```
git -c user.name="Claude Code" -c user.email="claude@anthropic.com" commit -m "..."
```
用户要求**一个提交只做一件事**；中文 message 直接 `-m` 没问题（UTF-8 正常）。

## 常用命令
- `npm run check` — 提交前必跑，期望 4/4 passed
- `npm run dev` — Vite 开发服务器（默认 5173）
- `npm run build` / `npm run dist:electron` / `npm run apk`

## 联机模式的核心不变量（改 LAN 相关代码前必读）
**只有房主可以修改权威 GameState；客户端只上行意图、只渲染广播。**
`src/App.tsx` 里几乎所有 effect 都会在两端各跑一遍，很容易违反这条不变量。
已经踩过的坑（2026-09-27 修复）：
- 发牌动画 effect 两端各洗一次牌 → 两边牌面分叉。客户端必须 early return。
- 房主自己的手牌点击被路由到 `sendToHost()`，而它在 host 角色下直接返回 false。
- `waitingForAi` 只在 `handleCardClick` 里复位 → 轮到人类时闩锁 true，
  **单人模式也会死锁**。两个 AI effect 里出完牌都要立刻清掉。
- `lan-peer.ts` 客户端侧必须 `setupHostChannel(conn)`，否则收不到任何下行数据。

## 端到端测试联机功能（本机可行方案）
没有 agent-browser，但系统有 Edge。做法见
`.workbuddy-ai/memory/2026-09-27.md` 的"复现/验证要点"。
关键点：`playwright-core` 装在
`C:\Users\Administrator\.workbuddy-ai\binaries\node\workspace`（用 `NODE_PATH` 引入），
两个 `browser.newContext()` 隔离存储才等价两台机器，
信令服务器用 `tsc --ignoreConfig` 编译 `electron/peer-server.ts` 后独立跑在 9000。

