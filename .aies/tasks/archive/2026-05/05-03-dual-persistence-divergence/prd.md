# 双持久化层ProjectService与SQLite数据不一致

## 需求背景

AITerm 目前存在**两套并行的 project 持久化机制**，导致数据可能不一致：

**机制 1：ProjectService（JSON 文件）**
- 路径：`~/.aiterm/projects.json`
- 使用方：`server/routes.mjs` 中 `GET/POST/DELETE /api/projects` 路由
- AppBusiness.ts 通过 `getProjects()` / `addProject()` / `removeProject()` 读写

**机制 2：DatabaseService（SQLite）**
- 路径：`~/.aiterm/aiterm.db` → `projects` 表
- 使用方：`GET /api/state` 返回的 `projects` 字段
- AppBusiness.ts 通过 `scheduleSyncProjectsToSQLite()` 异步同步过去

**问题场景**：
- `removeProject()` 调用 `apiRemoveProject()` 删除 JSON 文件中的记录 ✓
- 然后 `scheduleSyncProjectsToSQLite()` 把当前内存中的 projects（已删除）同步到 SQLite ✓
- **但删除时不删除该 project 下的 terminals 和 editors**：SQLite 的 `terminals` 和 `editors` 表仍保留孤立记录
- 重启后 `loadTerminals()` 会拉出孤立终端，`loadEditors()` 会拉出孤立编辑器

另外，当应用启动时若 SQLite 内容与 JSON 文件不一致（比如 JSON 被外部修改），会出现数据错位。

## 涉及文件

- `server/services/ProjectService.mjs` — JSON 文件持久化
- `server/services/DatabaseService.mjs` — SQLite 持久化，缺少 cascade delete
- `src/store/AppBusiness.ts` — `removeProject()` 不清理孤立数据
- `server/routes.mjs` — `DELETE /api/projects/:id` 路由只删 JSON 不删 SQLite 关联数据

## 技术方案

### 短期（推荐先做）

在 `removeProject()` 调用链中，删除 project 时同步清理关联数据：

1. `server/routes.mjs` 的 `DELETE /api/projects/:id` 除删 JSON 外，还调用 `dbService.deleteTerminalsByProject(projectId)` 和 `dbService.deleteEditorsByProject(projectId)`
2. 在 `DatabaseService.mjs` 中新增这两个方法

### 长期（架构统一）

废弃 `ProjectService`（JSON 文件），project 全面迁移到 SQLite，让 `DatabaseService` 成为唯一的持久化层。

## 优先级

P1 — 影响重启后的数据完整性，但不影响运行中的核心功能。
