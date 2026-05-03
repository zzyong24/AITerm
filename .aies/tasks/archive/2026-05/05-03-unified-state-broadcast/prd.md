# PRD: 所有状态变更统一广播

## 背景

AITerm 有两条写入路径：IPC（Electron 本地）和 HTTP（Web 客户端）。
之前只有 HTTP 路由会触发 WebSocket 广播，IPC 写入完全静默。
本任务将所有状态变更（projects / terminals / editors / settings）统一走 Service 层 EventEmitter 广播，
保证任意写入路径都能同步给所有连接的客户端。

## 范围

所有涉及"持久状态"的写入操作：
- **projects**：添加、删除、重命名（ProjectService）
- **terminals**：创建、更新、删除、重命名（DatabaseService）
- **editors**：保存、删除、清除（DatabaseService）
- **settings**：editorPath、terminalFontSize（ProjectService）

## 方案

Service 层（ProjectService / DatabaseService）继承 EventEmitter，
所有写方法在写入完成后调用 `this.emit('changed', { entity: '...' })`。

`routes.mjs` 的 WS 初始化块统一监听这些事件并调用 `broadcastToWs()`，
移除路由 handler 内的手动 broadcastToWs 调用，消除双重广播风险。

terminal-renamed 作为 UI 专用即时信号保留独立 event 类型（不影响全量 state reload）。

## 实现要点

1. `ProjectService.setEditorPath()` / `setTerminalFontSize()` → 添加 `emit('changed', { entity: 'settings' })`
2. `POST /api/terminals/:id/rename` → 改为写 DB（`dbService.updateTerminal`）+ `ptyService.emit('terminal-renamed', ...)`，移除直接 broadcastToWs 调用
3. `routes.mjs` WS 块 → 新增 `ptyService.on('terminal-renamed', ...)` 监听
