# 验收与测试：双持久化层ProjectService与SQLite数据不一致

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 操作 | 期望结果 |
|---|------|------|--------|
| AC-01 | 删除 project 清理孤立终端 | 新建 project + 几个 terminal，然后删除 project，重启 | 重启后无孤立 terminal，SQLite `terminals` 表无该 projectId 的记录 |
| AC-02 | 删除 project 清理孤立编辑器 | 新建 project + 打开几个文件，然后删除 project，重启 | 重启后无孤立 editor，SQLite `editors` 表无该 projectId 的记录 |
| AC-03 | JSON 与 SQLite 一致性 | 启动应用后检查两个持久化层 | `projects.json` 和 SQLite `projects` 表内容一致 |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] `DatabaseService.mjs` 新增 `deleteTerminalsByProject(projectId)` 和 `deleteEditorsByProject(projectId)` 方法
- [ ] `DELETE /api/projects/:id` 路由调用上述新方法进行级联清理
