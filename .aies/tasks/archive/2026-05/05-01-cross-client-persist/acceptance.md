# 验收标准：Terminal/项目跨端持久化

## P0 验收场景（必须全部通过）

| # | 场景描述 | 输入条件 | 期望结果 | 状态 |
|---|---------|---------|---------|------|
| AC-01 | SQLite 持久化存储 | 重启应用 | 状态不依赖 localStorage，存储在 `~/.aiterm/aiterm.db` | ✅ 已实现 |
| AC-02 | API 响应结构正确 | GET /api/state | 返回 projects/terminals/editors 三个数组 | ✅ 已实现 |
| AC-03 | Terminal 持久化 | 创建 Terminal 后重启 | 名称、cwd、history、lastActiveAt 自动恢复 | ✅ 已实现 |
| AC-04 | 项目链接持久化 | 添加/删除项目后重启 | 列表保持，顺序保持 | ✅ 已实现 |
| AC-05 | 编辑器持久化 | 打开文件后刷新页面 | 文件恢复，scrollToLine 保持 | ✅ 已实现 |
| AC-06 | Terminal CRUD | POST/PUT/DELETE /api/persist/terminals | 创建、更新、删除均正常 | ✅ 已实现 |
| AC-07 | 编辑器状态 PUT | PUT /api/editors | editors 状态正确保存 | ✅ 已实现 |
| AC-08 | 批量更新状态 | PUT /api/state | projects/terminals/editors 批量更新 | ✅ 已实现 |

## P1 验收场景（多端同步，当前仅本地 SQLite）

| # | 场景描述 | 输入条件 | 期望结果 | 状态 |
|---|---------|---------|---------|------|
| AC-09 | 多端数据一致 | 通过 Tailscale 访问不同设备 | 共享同一份 SQLite 数据（当前仅本地） | ⚠️ 待网络化 |
| AC-10 | 向后兼容迁移 | localStorage 旧数据 | 迁移到 SQLite | ⚠️ 未实现 |

## 当前实现说明

### 已实现
- **DatabaseService.mjs** — SQLite 封装，表结构初始化，读写 CRUD
- **server/index.mjs** — REST API 暴露（/api/state, /api/persist/*, /api/editors）
- **cross-client-persist.spec.ts** — 5 个 e2e 测试

### 待实现
- 多端同步：通过 Tailscale 等网络方案访问同一 SQLite 文件（当前仅本地）
- 向后兼容：localStorage → SQLite 数据迁移

## 验收通过标准

- [x] AC-01 ~ AC-08 全部通过
- [ ] AC-09, AC-10（多端网络同步方案待定）
