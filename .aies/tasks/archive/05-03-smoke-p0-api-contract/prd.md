# P0 冒烟修复：API 契约断层（3 个 bug）

## 需求背景

冒烟测试发现三处 API 签名不一致，在 Electron 模式下会造成运行时 `undefined` 调用或丢失参数，导致 terminal 无法关联 project、editors 刷新失败。

## Bug 列表

### BUG-01：`renameTerminal` IPC 缺失
- **位置**：`src/api/electron-ipc.ts`
- **现象**：`api.renameTerminal` 在 Electron 模式下为 `undefined`，调用时 crash
- **根因**：`electron-ipc.ts` 未实现 `renameTerminal`，`index.ts` line 91 直接导出 `api.renameTerminal`

### BUG-02：`persistTerminal` 丢失 `projectId` 第五参数
- **位置**：`src/api/http.ts`、`src/api/electron-ipc.ts`、`electron/main.ts`
- **现象**：AppBusiness.ts line 698 调用 `persistTerminal(id, name, cwd, null, projectId)`，但函数只接受 4 个参数；`electron/main.ts` `persist-terminal` handler 也只转发 4 个参数给 `dbService.addTerminal`
- **根因**：persistTerminal 设计时漏掉了 `projectId`

### BUG-03：`stateChangedListener` editors 分支传 UUID 给需要 path 的 API
- **位置**：`src/store/AppBusiness.ts` line 439-443
- **现象**：`entity === 'editors'` 时，用 `this.editors.map(e => e.projectId)` 拿到的是 UUID，传给 `apiLoadEditors(pid)` — 但 `loadEditors` 在 HTTP 模式下通过 `/load-editors?projectPath=` 路由，需要文件系统路径
- **根因**：`pid` 是 project UUID，应通过 `this.projects` 查表得到 `project.path`

## 技术方案

1. **BUG-01**：在 `electron-ipc.ts` 新增 `renameTerminal`，通过 IPC `rename-terminal-session` channel 调用（需在 `electron/main.ts` 对应 IPC handler 中实现）
2. **BUG-02**：
   - `http.ts` + `electron-ipc.ts` 函数签名增加 `projectId?: string | null`
   - `electron/main.ts` `persist-terminal` handler 增加第 5 参数并传给 `dbService.addTerminal`
3. **BUG-03**：在 editors 分支通过 `this.projects.find(p => p.id === pid)?.path` 转换后再调用 `apiLoadEditors`

## 依赖
- `electron/main.ts` 需要有 `rename-terminal-session` IPC channel（检查是否已存在，否则需新增）
