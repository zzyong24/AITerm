# Cross-Layer — 跨层边界检查

> **防止的问题**：层职责混乱（Handler 直接查 DB，Model 层包含业务逻辑），导致代码耦合难维护。

---

## AITerm 项目分层（TypeScript 全栈）

```
┌─────────────────────────────────────────────────────┐
│  Vue 组件层（Renderer Process）                      │
│  职责：UI 渲染、用户交互、事件响应                    │
│  禁止：绕过 AppBusiness 直接调用 API / 直接改 state  │
├─────────────────────────────────────────────────────┤
│  AppBusiness.ts（业务逻辑层 / 状态中枢）             │
│  职责：业务编排、状态管理、事件 notify               │
│  禁止：操作 DOM、UI 细节                             │
├─────────────────────────────────────────────────────┤
│  API 层（src/api/）                                 │
│  职责：HTTP/IPC 通信抽象，开发=HTTP，打包=IPC        │
│  禁止：任何业务逻辑                                  │
├─────────────────────────────────────────────────────┤
│  PtyService / server/services（服务层）              │
│  职责：PTY 生命周期、状态持久化、WebSocket 广播      │
│  禁止：业务决策                                     │
└─────────────────────────────────────────────────────┘
```

**依赖方向**：Vue 组件 → AppBusiness → API → Server Service（严格单向）

---

## Server-as-SSOT 单向数据流（必读）

> 适用场景：凡涉及 sessions 状态同步的代码。

**核心约束**：`sessions[]` 的权威来源是服务端 PtyService，客户端只能接收替换，不能自行修改。

```
Server (PtyService)
    │  broadcast sessions_snapshot
    ▼
WebSocket
    │
    ▼
AppBusiness.onSessionsSnapshot(sessions)   ← 唯一写入入口
    │  atomic replace sessions[]
    ▼
rebuildTabsFromSessions()                  ← 重新投影 tabs，保留 uiPrefs
    │
    ▼
notify → Vue 组件重渲染
```

**❌ 禁止**：

```typescript
// ❌ 客户端自己 push session（破坏 SSOT）
this.sessions.push(newSession)

// ❌ 本地 filter 删除 session（应由 snapshot 替换）
this.sessions = this.sessions.filter(s => s.id !== id)
```

**✅ 正确**：

```typescript
// ✅ 乐观 UI：只改 tabs（视觉层），session 状态等 snapshot 更新
this.tabs[tabIdx].items = this.tabs[tabIdx].items.filter(i => i.id !== sessionId)
notify(AppEvents.TABS_CHANGE)
// 乐观更新后 API 异步调用；失败时 server snapshot 会自动修正

// ✅ server 广播时统一替换
onSessionsSnapshot(sessions: TerminalSession[]): void {
  this.sessions = sessions  // 原子替换
  this.rebuildTabsFromSessions()
}
```

---

## 检查清单

写代码前，逐项确认：

- [ ] **我在哪层写代码？** 明确当前函数属于哪一层
- [ ] **我调用了哪些东西？** 列出调用的函数/对象
- [ ] **调用方向对吗？** 组件不能绕过 AppBusiness 直接调 API
- [ ] **是否涉及 sessions 状态？** 如是，必须走 onSessionsSnapshot，不能直接赋值
- [ ] **有没有循环依赖？** A 依赖 B，B 又依赖 A → 必须抽象接口解决

---

## ❌ 典型错误（TypeScript 版）

```typescript
// Vue 组件直接改 sessions（越层）
const appBusiness = inject('appBusiness')
appBusiness.sessions.push({ id: 'xxx', ... })  // ❌

// AppBusiness 直接操作 DOM
document.querySelector('.terminal')?.focus()  // ❌

// 客户端本地 filter sessions（破坏 SSOT）
this.sessions = this.sessions.filter(s => s.id !== closedId)  // ❌
```

---

## ✅ 正确做法（TypeScript 版）

```typescript
// Vue 组件：只调业务方法，不操作状态
const onClose = (sessionId: string) => {
  appBusiness.closeSession(sessionId)  // ✅ 委托给 AppBusiness
}

// AppBusiness：乐观 UI + 等待 snapshot 修正
async closeSession(sessionId: string): Promise<void> {
  // 乐观：立即更新 tabs（视觉层）
  const tabIdx = this.tabs.findIndex(t => t.items.some(i => i.id === sessionId))
  if (tabIdx >= 0) {
    this.tabs[tabIdx].items = this.tabs[tabIdx].items.filter(i => i.id !== sessionId)
    this.notifyTabsChange()
  }
  // 异步调用 API；server snapshot 最终修正 sessions
  await apiCloseTerminalSession(sessionId).catch(console.error)
}
```
