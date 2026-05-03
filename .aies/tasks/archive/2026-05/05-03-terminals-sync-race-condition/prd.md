# 终端同步删全重插存在竞态条件

## 需求背景

`AppBusiness.ts` 中的 `syncTerminalsToSQLite()` 方法实现如下（精简）：

```ts
private async syncTerminalsToSQLite() {
  const terminals = this.sessions.map(s => ({ id: s.id, name: s.name, cwd: s.workingDir }))
  await updateFullState({ terminals })  // ← DELETE ALL + re-insert
}
```

`updateFullState` 在服务端对 `terminals` 表执行的是**全量替换**：先 DELETE 所有记录，再批量 INSERT。

这在两个客户端并发写入时会产生竞态：

1. 客户端 A 有终端 [1, 2, 3]，客户端 B 有终端 [1, 2, 4]
2. A 调用 `syncTerminalsToSQLite()` → 先 DELETE ALL，还没 INSERT
3. B 同时调用 `syncTerminalsToSQLite()` → DELETE ALL（把 A 写了一半的也清掉）→ INSERT [1,2,4]
4. A 的 INSERT 完成 → INSERT [1,2,3]，覆盖了 B 的 4

结果：数据库只剩 [1,2,3]，终端 4 丢失。

此外，`electron/main.ts` 中的 `update-full-state` IPC handler 直接操作 `dbService.db.prepare()` 绕过了 `DatabaseService` 的抽象，增加了维护风险。

## 涉及文件

- `src/store/AppBusiness.ts` — `syncTerminalsToSQLite()` 使用批量替换
- `server/routes.mjs` — `PUT /api/state` 的实现（全量替换逻辑）
- `electron/main.ts` — `update-full-state` IPC handler 直接调用 `db.prepare()`

## 技术方案

### 方案：精确增删替代全量替换

废弃 `syncTerminalsToSQLite()` 的全量同步模式，改为精确操作：

- 新增终端 → `persistTerminal(id, name, cwd)` （已有接口）
- 删除终端 → `removePersistedTerminal(id)` （已有接口）
- 重命名终端 → `updatePersistedTerminal(id, { name })` （已有接口）

这些接口已在 `http.ts` 中实现，服务端已有对应路由，只是 `AppBusiness.ts` 没有使用它们。

同时修复 `electron/main.ts` 中绕过 `DatabaseService` 的直接 db 操作。

## 优先级

P1 — 单客户端使用时不触发，多端并发或频繁操作时可能导致终端列表数据丢失。
