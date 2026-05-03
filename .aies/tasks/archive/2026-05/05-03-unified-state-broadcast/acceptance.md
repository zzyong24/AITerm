# Acceptance Criteria: 所有状态变更统一广播

## AC-01: settings 变更广播

**场景**：客户端 A 调用 `POST /api/settings/editor` 修改编辑器路径

**验收**：
- WebSocket 收到 `{ type: "state_changed", entity: "settings" }` 消息
- IPC 路径（electron/main.ts 的 `set-editor-path` handler）同样触发广播
- 同理适用于 `POST /api/settings/terminal-font-size`

## AC-02: terminal 重命名广播且持久化

**场景**：客户端 A 调用 `POST /api/terminals/:id/rename`

**验收**：
- WebSocket 收到 `{ type: "terminal-renamed", sessionId: "...", name: "..." }` 即时消息
- WebSocket 同时收到 `{ type: "state_changed", entity: "terminals" }` 持久化确认
- 刷新页面后 terminal 名称仍为重命名后的值（SQLite 持久化验证）
- 等同于 AC-05 in 05-03-no-cross-client-sync

## AC-03: 无手动 broadcastToWs 调用残留

**场景**：代码审查

**验收**：
- `routes.mjs` 的路由 handler 内不存在直接调用 `broadcastToWs()` 的代码
- 所有广播均通过 `projectService.on/dbService.on/ptyService.on` 事件驱动触发
- 唯一例外：ptyService 的 output/closed/activity 事件（非状态变更，保持现有结构）

## AC-04: 统一事件格式

**验收**：
- 所有状态变更消息格式：`{ type: "state_changed", entity: "<entity>" }`
- entity 取值：`projects` | `terminals` | `editors` | `settings`
- UI 专用消息格式：`{ type: "terminal-renamed", sessionId: "...", name: "..." }`
