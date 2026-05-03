# PRD: Electron 创建的终端在浏览器端实时可见

## 背景

用户在 Electron 客户端打开一个终端，切换到浏览器 5003 端口后看不到这个终端。
预期行为：Electron 和浏览器端的终端列表应该实时同步。

## 问题根因

### 链路分析

1. Electron 用户创建终端 → IPC `create-terminal-session` → PtyService 创建 PTY
2. `persistTerminal` IPC → 写 SQLite → `dbService.on('changed')` → WS 广播 `state_changed { entity: 'terminals' }`
3. 浏览器收到 WS 消息 `state_changed { entity: 'terminals' }`
4. `AppBusiness.stateChangedListener` handler → `eventBus.emit('terminals:remote-changed')` **← 死事件，无监听者**
5. 浏览器 UI 无响应

### 错误的原有设计

- `eventBus.emit('terminals:remote-changed')` 发出后无任何组件监听
- `restoreAllTerminals()` 逻辑会创建新 PTY 进程（调 `launchTerminal` → `apiCreateTerminalSession`），不适合采用已存在的远端 session

## 解决方案

### 核心设计

**Session 采用（Adoption）**而非 Session 创建：
- 浏览器收到 `state_changed { entity: 'terminals' }` 时，调用 `GET /api/terminals`（`listSessions`）
- Diff 服务端 sessions 与本地 sessions
- 对于本地没有的 session，调用 `adoptSession()` 方法：只在 UI 添加 session/tab 条目，**不调用 `apiCreateTerminalSession`**

### 关键实现

1. `AppBusiness.adoptSession(id, projectId, projectName, workingDir)` — 无 PTY 创建的 session 注册
2. `AppBusiness.syncRemoteSessions()` — 拉取远端 sessions 并差量 adopt
3. `stateChangedListener` entity=terminals 分支 → 调用 `syncRemoteSessions()`（替换原来的死事件）

## 范围

- `src/store/AppBusiness.ts`：3 处改动
  - import 加 `listSessions as apiListSessions`
  - `stateChangedListener` terminals 分支替换死事件
  - 新增 `adoptSession` + `syncRemoteSessions` 方法
