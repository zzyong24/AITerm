# P2 冒烟修复：settings 变更无 WS 广播

## 需求背景

`DatabaseService.setSetting` 是所有设置写入的最终路径，但写入后没有 `this.emit('changed', { entity: 'settings' })`，导致服务端无法向所有 WS 客户端广播 `state_changed` 事件。即使 BUG-06 修复了客户端的接收逻辑，源头不发消息也无济于事。

## Bug

### BUG-08：`DatabaseService.setSetting` 缺少 emit
- **位置**：`server/services/DatabaseService.mjs` line 344-349
- **现象**：`setSetting('terminal-font-size', '16')` 写入 SQLite 后不触发 `changed` 事件，`routes.mjs` 的监听器 `dbService.on('changed', ...)` 不触发，WS 广播不发出
- **根因**：其他所有写方法（addProject, addTerminal, saveEditor 等）都有 `this.emit('changed', ...)`，唯独 `setSetting` 漏掉了

## 技术方案

在 `setSetting` 的 `stmt.run` 之后补加：
```javascript
this.emit('changed', { entity: 'settings' })
```

## 依赖
- BUG-06（P1）：客户端需有 settings 分支处理才能接收这个广播
