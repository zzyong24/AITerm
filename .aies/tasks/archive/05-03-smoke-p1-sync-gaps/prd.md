# P1 冒烟修复：同步链路缺口（4 个 bug）

## 需求背景

服务端广播了 `terminal-renamed` 事件，但浏览器端没有注册对应 listener，导致 Tab 标签重命名不能实时同步到其他客户端。此外 `renameProject` 未调用 HTTP API，settings 变更后无跨端广播，`clearTerminals` 在 Electron 模式下为 `undefined`。

## Bug 列表

### BUG-04：浏览器端无 `terminal-renamed` WS 监听
- **位置**：`src/api/http.ts`
- **现象**：服务端 `routes.mjs` line 638 广播 `{ type: 'terminal-renamed', sessionId, name }`，但 `http.ts` 没有注册 `terminal-renamed` handler，浏览器收到消息后直接丢弃
- **根因**：漏实现 WS listener 导出函数

### BUG-05：`renameProject` 不调用 HTTP API
- **位置**：`src/store/AppBusiness.ts` line 291-300
- **现象**：`renameProject` 只修改内存 + 触发 SQLite sync，但不调用 `apiRenameProject`（`PATCH /api/projects/:id`），导致项目名称改变在服务端未持久化
- **根因**：`apiRenameProject` 函数存在于 `http.ts`，但 `AppBusiness.ts` 未 import 也未调用

### BUG-06：`stateChangedListener` 无 `settings` 分支
- **位置**：`src/store/AppBusiness.ts` line 426-445
- **现象**：`entity === 'settings'` 的 WS 广播到达时，stateChangedListener 没有处理分支，导致一个客户端改字体大小，另一个客户端不刷新
- **根因**：漏加 settings 分支，需重新拉取 `editorPath` 和 `terminalFontSize`

### BUG-07：`clearTerminals` IPC 缺失
- **位置**：`src/api/electron-ipc.ts`
- **现象**：`api.clearTerminals` 在 Electron 模式下为 `undefined`
- **根因**：`electron-ipc.ts` 未实现，`index.ts` line 90 直接导出 `api.clearTerminals`

## 技术方案

1. **BUG-04**：在 `http.ts` 新增 `terminalRenamedListener`，注册 `terminalWs.on('terminal-renamed', callback)` 并导出；在 `index.ts` 导出；在 `AppBusiness.ts` 订阅，收到后更新对应 session 的 name 并 notify
2. **BUG-05**：在 `AppBusiness.ts` import `renameProject as apiRenameProject`，在 `renameProject` 方法中调用，失败时回滚内存
3. **BUG-06**：在 stateChangedListener 的 `settings` 分支重新拉取 `editorPath` 和 `terminalFontSize`，更新本地状态并 `notifySettingsChange()`
4. **BUG-07**：在 `electron-ipc.ts` 新增 `clearTerminals`，调用已有 IPC channel `clear-terminals`；对应 `electron-ipc.ts` stub 也保证签名一致

## 依赖
- BUG-04 还需在 `electron-ipc.ts` 增加对应 no-op stub（IPC 模式不通过 WS 接收重命名事件）
