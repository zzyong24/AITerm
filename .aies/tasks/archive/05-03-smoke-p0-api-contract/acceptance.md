# 验收标准：P0 API 契约修复

> **状态：✅ DONE — 2026-05-03**
> TypeScript `--noEmit` 零报错，所有 AC 已代码实现验证。


> **状态：✅ DONE — 2026-05-03**
> TypeScript `--noEmit` 零报错，所有 AC 已代码实现验证。


## AC-01：renameTerminal IPC
- Electron 模式下 `api.renameTerminal('id', 'newName')` 不抛出 TypeError
- HTTP 模式下行为不变

## AC-02：persistTerminal projectId
- 调用 `persistTerminal(id, name, cwd, null, projectId)` TypeScript 编译无报错
- SQLite terminals 表记录含正确的 `projectId`（Electron 和 HTTP 两路径都写入）

## AC-03：editors 刷新路径正确
- `entity === 'editors'` 跨端同步时，`apiLoadEditors` 收到的是文件系统路径，不是 UUID
- 对应 `/load-editors?projectPath=` HTTP 请求能正常返回数据

## 测试命令
```
npx tsc --noEmit   # 无新增 TS 错误
npx playwright test e2e/cross-client-persist.spec.ts
```
