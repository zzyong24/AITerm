# 验收标准：Electron 终端跨端同步

## AC-01: 死事件替换

- `AppBusiness.ts` 中 `terminals` 分支不再调用 `eventBus.emit('terminals:remote-changed')`
- 改为调用 `this.syncRemoteSessions()`

## AC-02: syncRemoteSessions 正确实现

- 调用 `apiListSessions()` 获取服务端所有活跃 PTY sessions
- 对本地已存在的 session（同 ID）跳过
- 对新 session 调用 `adoptSession` 而非 `launchTerminal`

## AC-03: adoptSession 不创建新 PTY

- `adoptSession` 方法：将 session 加入 `this.sessions` 和 `this.tabs`
- **不调用** `apiCreateTerminalSession`
- 幂等：同 ID 调用两次不会重复添加

## AC-04: 跨端终端同步 e2e

- `Terminal CRUD` e2e 测试通过（验证创建/更新/删除的基础持久化）
- `Terminal 重命名后刷新页面，名称保持` 通过
