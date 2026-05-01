# Terminal/项目跨端持久化

## 需求背景

通过 Tailscale 访问时，多端（桌面 App 端、浏览器端、手机端）需要共享同一份状态：
- 项目链接列表
- Terminal 会话（名称、cwd、history）
- 打开的编辑器状态

当前实现使用浏览器 localStorage，导致切换设备后状态丢失。

## 技术方案（已实现）

### 存储选型
- **SQLite**：轻量、无依赖、跨平台，支持多端连接同一文件
- 数据库路径：`~/.aiterm/aiterm.db`
- 服务端读写，HTTP API 暴露给各端

### 数据模型

```
projects
  - id: TEXT PRIMARY KEY
  - name: TEXT
  - path: TEXT
  - order: INTEGER
  - createdAt: TEXT
  - lastAccessedAt: TEXT

terminals
  - id: TEXT PRIMARY KEY
  - projectId: TEXT
  - name: TEXT
  - cwd: TEXT
  - taskSlug: TEXT
  - history: TEXT (JSON array)
  - createdAt: TEXT
  - lastActiveAt: TEXT

editors
  - projectId: TEXT
  - id: TEXT PRIMARY KEY
  - path: TEXT
  - name: TEXT
  - scrollToLine: INTEGER
  - PRIMARY KEY(projectId, id)
```

### API 设计

| API | 方法 | 说明 |
|-----|------|------|
| `/api/state` | GET | 获取完整状态（projects + terminals + editors） |
| `/api/state` | PUT | 批量更新状态 |
| `/api/persist/terminals` | POST | 创建 terminal |
| `/api/persist/terminals/:id` | PUT | 更新 terminal |
| `/api/persist/terminals/:id` | DELETE | 删除 terminal |
| `/api/editors` | PUT | 更新 editors 状态 |

### 多端同步策略（当前仅本地）
- 各端启动时从 SQLite 拉取状态
- 状态变更时自动推送到 SQLite
- 多端网络同步方案待定（通过 Tailscale 访问同一文件）

## 影响范围

- 新增文件：
  - `server/services/DatabaseService.mjs` — SQLite 封装
  - `e2e/cross-client-persist.spec.ts` — e2e 测试
- 修改文件：
  - `server/index.mjs` — 新增 REST API

## 依赖
- better-sqlite3（已引入）

## 当前状态

✅ AC-01 ~ AC-08 已实现并通过 e2e 测试
⚠️ AC-09, AC-10（多端网络同步）待实现
