# 验收与测试：终端同步删全重插存在竞态条件

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 操作 | 期望结果 |
|---|------|------|--------|
| AC-01 | 新建终端持久化 | 新建一个 terminal tab | SQLite `terminals` 表立即出现新记录 |
| AC-02 | 删除终端持久化 | 关闭一个 terminal tab | SQLite `terminals` 表立即删除该记录 |
| AC-03 | 重命名终端持久化 | 重命名 terminal | SQLite `terminals` 表记录 name 字段更新 |
| AC-04 | 无全量替换操作 | 任何终端增删改操作 | 不触发 DELETE ALL，只执行精确的单条操作 |
| AC-05 | 绕过抽象修复 | 查看 electron/main.ts | `update-full-state` handler 改为调用 `DatabaseService` 方法，不直接用 `db.prepare()` |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] `syncTerminalsToSQLite()` 方法已废弃或重写，不再调用 `updateFullState({ terminals })`
- [ ] 终端操作均走 `persistTerminal` / `removePersistedTerminal` / `updatePersistedTerminal`
