# 验收标准：P1 同步链路修复

> **状态：✅ DONE — 2026-05-03**
> TypeScript `--noEmit` 零报错，所有 AC 已代码实现验证。


> **状态：✅ DONE — 2026-05-03**
> TypeScript `--noEmit` 零报错，所有 AC 已代码实现验证。


## AC-04：terminal-renamed 实时同步
- 一个浏览器客户端重命名 terminal 后，另一个客户端 tab 标签在 <1s 内更新
- `terminalRenamedListener` 函数可从 `src/api` 导出并在 AppBusiness 中订阅

## AC-05：renameProject HTTP 持久化
- 浏览器调用 `renameProject`，服务端 `PATCH /api/projects/:id` 收到请求并写入存储
- HTTP API 调用失败时，内存中的名称回滚，不出现前后不一致

## AC-06：settings 跨端同步
- 一个客户端调用 `setTerminalFontSize`，另一个客户端在收到 `entity === 'settings'` 后自动更新字体大小

## AC-07：clearTerminals Electron 可用
- Electron 模式下 `api.clearTerminals('path')` 不抛出 TypeError
- IPC channel `clear-terminals` 正常响应

## 测试命令
```
npx tsc --noEmit
npx playwright test e2e/cross-client-persist.spec.ts
```
