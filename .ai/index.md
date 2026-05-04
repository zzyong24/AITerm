# AITerm — 项目地图

> 禁止编造。本文件记录真实存在的模块、公开方法和接口。
> 更新时间：2026-05-04

---

## 核心模块

### `src/store/AppBusiness.ts`

全局单例 `appBusiness`，是业务逻辑唯一入口。

**状态属性**

| 属性 | 类型 | 说明 |
|------|------|------|
| `sessions` | `TerminalSession[]` | 终端会话列表（Server-as-SSOT，只由 onSessionsSnapshot 写入） |
| `tabs` | `ProjectTab[]` | 项目 Tab 列表（从 sessions 派生，由 rebuildTabsFromSessions 维护） |
| `projects` | `Project[]` | 项目列表 |
| `uiPrefs` | `{ activeItemId?: string }` | UI 偏好（跨 snapshot 保持） |

**公开方法**

| 方法 | 签名 | 说明 |
|------|------|------|
| `initialize` | `(): Promise<void>` | 应用初始化，加载项目+会话，订阅 WS 事件 |
| `addProject` | `(name, path, group?): Promise<Project>` | 新增项目 |
| `launchTerminal` | `(projectId, projectName, workingDir?): Promise<string>` | 创建新 PTY（返回 sessionId），无去重 |
| `closeSession` | `(sessionId): Promise<void>` | 乐观关闭：立即更新 tabs，异步调用 API |
| `restoreAllTerminals` | `(): Promise<void>` | 页面刷新后从 SQLite 记录恢复终端 |
| `onSessionsSnapshot` | `(sessions): void` | **SSOT 入口** — 原子替换 sessions[]，触发 rebuildTabsFromSessions |

**私有方法（文档用）**

| 方法 | 说明 |
|------|------|
| `rebuildTabsFromSessions()` | 从 sessions 投影 tabs，保留 editor items，恢复 uiPrefs.activeItemId |

**事件（AppEvents）**

`PROJECTS_CHANGE` · `SESSIONS_CHANGE` · `EDITORS_CHANGE` · `TABS_CHANGE` ·
`ACTIVE_PROJECT_CHANGE` · `SETTINGS_CHANGE` · `ACTIVITY_CHANGE` ·
`SESSION_WAITING` · `SESSION_FAILED` · `INITIALIZED`

---

### `electron/services/PtyService.ts` / `server/services/PtyService.ts`

PTY 生命周期管理，**Server-as-SSOT 广播源**。

| 方法 | 说明 |
|------|------|
| `createSession(projectId, projectName, cwd)` | 创建 PTY，广播 `sessions_snapshot` |
| `closeSession(sessionId)` | 关闭 PTY，广播 `sessions_snapshot` |
| `renameSession(sessionId, name)` | 重命名，广播 `sessions_snapshot` |
| `getSessions()` | 返回当前所有 session 快照 |

**WebSocket 事件**：`sessions_snapshot` → payload `{ sessions: TerminalSession[] }`

---

### `src/api/index.ts`

统一 API 入口，开发模式走 HTTP，打包走 Electron IPC。

常用函数前缀 `api*`：`apiCreateTerminalSession` · `apiCloseTerminalSession` ·
`apiGetProjects` · `apiAddProject` · `apiRenameSession`

---

### `src/utils/EventBus.ts`

单例 `eventBus`，`emit(event, payload)` / `on(event, handler)` / `off(event, handler)`

---

## 测试覆盖

| 文件 | 类型 | 状态 |
|------|------|------|
| `tests/AppBusiness.test.ts` | Unit (Vitest) | 27/27 ✅ |
| `e2e/terminal-sessions.spec.ts` | E2E (Playwright) | ✅ |
| `e2e/terminal-rename.spec.ts` | E2E (Playwright) | ✅ |
| `e2e/markdown-preview.spec.ts` | E2E (Playwright) | ✅ |
| `e2e/electron-web-server.spec.ts` | E2E (Playwright) | skip（需 Electron 运行） |

---

## 关键约定

- `sessions[]` 只能由 `onSessionsSnapshot()` 写入（Server-as-SSOT）
- `tabs[]` 是 `sessions[]` 的派生态，由 `rebuildTabsFromSessions()` 维护
- `closeSession()` 使用乐观 UI：立即更新 `tabs`，不等 API 响应
- Vitest 环境必须设为 `node`（见 `vite.config.ts`）
