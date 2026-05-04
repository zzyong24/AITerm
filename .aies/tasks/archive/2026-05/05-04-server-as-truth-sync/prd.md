# PRD: Server-as-Single-Truth 跨端状态同步重构

**日期**: 2026-05-04  
**状态**: IN PROGRESS

## 背景

当前架构：Electron renderer 和 Web(5003) 各自维护一份完整状态，靠后验 reconcile 对齐。
这是导致 "终端倍增"、"tab 显示跳变" 等 bug 的根本原因——两份状态不断产生竞争。

## 目标

将 session 状态所有权完全交给服务端（PTY 进程的持有者），
客户端降级为只读缓存 + 乐观 UI，彻底消除 reconcile 逻辑。

## 核心改动

### 1. 服务端：lifecycle 事件携带完整快照

**修改前**：
```js
broadcastToWs(JSON.stringify({ type: 'state_changed', entity: 'terminals' }))
```

**修改后**：
```js
broadcastToWs(JSON.stringify({ 
  type: 'sessions_snapshot', 
  sessions: ptyService.listSessions()   // 权威列表，直接内嵌
}))
```

触发时机（PtyService lifecycle 事件）：
- `createSession` 成功后
- `close` / PTY `onExit` 后
- `rename` 后

### 2. 客户端：删除 reconcile，换成 snapshot replace

**删除**：
- `syncRemoteSessions()` — 100 行 reconcile 逻辑
- `debouncedSyncRemoteSessions()` 
- `isSyncing` guard（terminals 分支专用的部分）
- `restoreAllTerminals()` 中的 `apiListSessions()` 查询 + reconcile

**新增**：
```typescript
private onSessionsSnapshot(remoteSessions: RemoteSession[]) {
  // 原子替换，不做 diff
  this.sessions = remoteSessions.map(r => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName || this.projects.find(p=>p.id===r.projectId)?.name || null,
    workingDir: r.workingDir,
    name: r.name || r.id.slice(0,8),
    alive: true,
    lastActivity: 0,
    children: [],
    activeSubId: null
  }))
  this.rebuildTabsFromSessions()
  this.notifySessionsChange()
  this.notifyTabsChange()
}
```

### 3. tabs 变为 session 的 derived state

`rebuildTabsFromSessions()` 从 sessions 投影出 tabs，
同时保留用户手动选择的 `activeItemId`（存 `uiPrefs` Map，不走服务端）：

```typescript
private uiPrefs = new Map<string, string>()  // projectId -> activeItemId

private rebuildTabsFromSessions() {
  const projectMap = new Map<string, ProjectTab>()
  for (const s of this.sessions) {
    if (!s.projectId) continue
    if (!projectMap.has(s.projectId)) {
      projectMap.set(s.projectId, {
        projectId: s.projectId,
        projectName: s.projectName || '',
        items: [],
        activeItemId: null
      })
    }
    projectMap.get(s.projectId)!.items.push({ id: s.id, type: 'terminal', name: s.name })
  }
  // 合并 editor items（不变）
  for (const tab of this.tabs) {
    const editorItems = tab.items.filter(i => i.type === 'editor')
    const rebuilt = projectMap.get(tab.projectId)
    if (rebuilt) {
      rebuilt.items.push(...editorItems)
    } else if (editorItems.length > 0) {
      // 该项目没有 session 了，但还有 editor，保留 tab
      projectMap.set(tab.projectId, { ...tab, items: editorItems })
    }
  }
  // 恢复 UI 偏好的 activeItemId
  for (const [pid, tab] of projectMap) {
    const preferred = this.uiPrefs.get(pid)
    tab.activeItemId = (preferred && tab.items.find(i => i.id === preferred))
      ? preferred
      : (tab.items.length > 0 ? tab.items[0].id : null)
  }
  this.tabs = [...projectMap.values()]
}
```

### 4. `closeSession` 简化

```typescript
async closeSession(sessionId: string) {
  // 乐观 UI：立即标记 alive=false 给用户即时反馈
  const s = this.sessions.find(s => s.id === sessionId)
  if (s) s.alive = false
  this.notifySessionsChange()
  
  // 发命令，快照自动回来对齐（包含从 sessions[] 中删除）
  await apiCloseTerminalSession(sessionId)
  // 不再手动修改 sessions/tabs，等 sessions_snapshot 回来
}
```

### 5. `restoreAllTerminals` 简化

不再需要 reconcile，只需：
1. 遍历 `persistedTerminals`，调 `launchTerminal`（PTY 恢复）
2. 服务端每次 `createSession` 都广播快照，客户端自动对齐

批量恢复期间服务端 debounce 广播（300ms），客户端不需要 `isSyncing`。

## 验收条件

1. 多窗口打开 AITerm，在一个窗口新建终端 → 另一个窗口 < 500ms 内同步显示，不重复
2. 在一个窗口关闭终端 → 另一个窗口同步消失，无残影
3. 重命名终端 → 两端 Tab 标签同步更新
4. 页面刷新 → 终端数量与刷新前完全一致（不倍增）
5. 快速关闭非激活 tab → 当前显示的 tab 不跳变
6. 所有单元测试通过（vitest）
7. 所有 e2e 测试通过（playwright）
