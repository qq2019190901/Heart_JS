# Heart_JS — 工作区长期记忆（AI 侧）

## 权威项目记忆在仓库里
本项目自带 `.workbuddy/memory/`（已提交进 git），是**项目约定的唯一权威来源**：
- `.workbuddy/memory/MEMORY.md` — 技术栈、目录约定、规则要点、刻意设计
- `.workbuddy/memory/YYYY-MM-DD.md` — 逐日工作日志

**开工前先读它们。** 本文件只记录 AI 侧的操作性知识，不重复其内容。

## 本机网络约定（重要，2026-09-27 实测修正）
- **github.com 直连是间歇性的**：`git ls-remote` / `fetch`（GET）有时通、有时 443 超时；
  **push（POST）几乎必失败**——`Recv failure: Connection was reset`。
  不要因为一次 ls-remote 成功就断定能推送。`curl https://github.com` 一直返回 000，不能作为判据。
- **推送需要 PAT**：`credential.helper = manager`（GCM）但 Windows 凭据库里**没有**
  github.com 条目（`cmdkey /list` 为空），`gh` 也未安装，非交互模式下 GCM 弹不出窗。
  实测可用方式——用环境变量传令牌 + 一次性 helper（**不落盘、不进 `ps`、不改 remote**）：
  ```
  export GH_TOKEN='<pat>'
  git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' \
      -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 push origin master
  ```
  **失败要重试**：连不上是常态，实测第 3 次才成功。别因为 1~2 次失败就放弃。
- 只读镜像 `https://ghfast.top/` 可用（前缀式：`https://ghfast.top/https://github.com/...`），
  适合 clone/fetch。**不要把凭据经第三方镜像推送。**
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

## Android 构建（工具链已装在 D:/dev-tools）
`dl.google.com` / `services.gradle.org` / `repo.maven.apache.org` 都被墙，全部走镜像装好了：
JDK 21（清华 TUNA Adoptium）、Gradle 8.13（腾讯）、SDK 36（腾讯 AndroidSDK 镜像）。
`~/.gradle/init.gradle` 把仓库重定向到阿里云；`android/local.properties` 指向 SDK。
```
npm run build && npx cap sync android
JAVA_HOME=D:\dev-tools\jdk-21 ANDROID_HOME=D:\dev-tools\android-sdk \
  D:\dev-tools\gradle-8.13\bin\gradle.bat assembleDebug
```
**用 assembleDebug**：release 签名要 `heart-js-keystore.keystore`，本地没有。
详细步骤、坑和验证手段见 `.workbuddy-ai/memory/2026-09-27.md` 第（七）节。

⚠️ **cap sync 在本机第二次起会失败**（沙箱 safe-delete shim 拦批量删除，绕不过）。
绕法：不删、直接 `cp -rf dist/. android/app/src/main/assets/public/` 覆盖，再手写
`assets/capacitor.config.json`。旧的 hash bundle 会残留在 APK 里。

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

