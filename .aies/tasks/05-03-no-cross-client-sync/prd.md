# 跨客户端状态变更无广播同步

## 需求背景

AITerm 支持两个并行客户端访问同一后端：
- **Electron 内嵌前端**（端口 5003）
- **浏览器开发前端**（Vite dev server，端口 5173）

两个客户端共用同一个 SQLite 数据库作为 source of truth。但目前 WebSocket 服务端（`server/routes.mjs`）仅转发 PTY 的 `output`/`closed`/`activity` 事件，**不广播任何状态变更事件**：

- 客户端 A 新增 project → 客户端 B 不刷新，看不到新项目
- 客户端 A 新建 terminal tab → 客户端 B 不刷新
- 客户端 A 关闭 editor → 客户端 B 不刷新
- 客户端 A 重命名 terminal → 客户端 B 不刷新

导致两端状态长期不一致，除非手动刷新页面。

## 涉及文件

- `server/routes.mjs` — WebSocket 广播逻辑，目前只广播 PTY 事件
- `src/api/http.ts` — WebSocket 客户端接收逻辑
- `src/store/AppBusiness.ts` — 需要响应广播事件重新加载状态

## 技术方案

### 服务端

在状态变更操作完成后，通过 `broadcastToWs()` 广播事件，告知所有客户端"有状态变化"：

| 操作 | 广播事件 | 数据 |
|------|---------|------|
| POST /api/projects | `state_changed` | `{ type: "project_added", id }` |
| DELETE /api/projects/:id | `state_changed` | `{ type: "project_removed", id }` |
| POST /api/persist/terminals | `state_changed` | `{ type: "terminal_added", id }` |
| DELETE /api/persist/terminals/:id | `state_changed` | `{ type: "terminal_removed", id }` |
| DELETE /api/editors/:projectId/:id | `state_changed` | `{ type: "editor_removed", projectId, id }` |
| PUT /api/terminals/:id (rename) | `state_changed` | `{ type: "terminal_renamed", id, name }` |

### 客户端

在 `AppBusiness.ts` 中监听 `state_changed` 事件：
- 收到 `project_added` / `project_removed` → 调用 `loadProjectsFromDB()` 刷新项目列表
- 收到 `terminal_added` / `terminal_removed` → 刷新终端列表（不重建 PTY，仅同步 UI 状态）
- 收到 `editor_removed` → 从本地 tabs 中移除对应 editor

## 优先级

P0 — 多端并行使用时核心功能失效。
