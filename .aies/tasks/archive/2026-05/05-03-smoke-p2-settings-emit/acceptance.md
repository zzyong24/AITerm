# 验收标准：P2 settings emit 修复

> **状态：✅ DONE — 2026-05-03**
> TypeScript `--noEmit` 零报错，AC-08 已在 DatabaseService.mjs 代码实现验证。


## AC-08：setSetting 触发 WS 广播
- 调用 `dbService.setSetting(key, value)` 后，所有 WS 客户端收到 `{ type: 'state_changed', entity: 'settings' }` 消息
- 可通过 `routes.mjs` 的 `dbService.on('changed', ...)` 日志验证

## 测试命令
```
# 手动验证：打开两个浏览器标签页，在一个标签页设置字体大小，另一个自动更新
npx playwright test e2e/cross-client-persist.spec.ts
```
