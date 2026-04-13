# Split 子终端问题分析

## 问题描述
用户双击项目启动终端后，点击 split 按钮（终端右上角 "+"）创建子终端时，"子终端 1" 按钮没有出现在 sub-terminal bar 中。

## 当前行为
1. 双击项目 → 终端正常显示
2. 点击 split "+" 按钮 → API 调用成功（返回 sessionId）→ 但 UI 不更新

## 代码流程

### 1. 创建终端（已正常）
```
App.vue handleLaunch() → appBusiness.launchTerminal() → API 创建终端 → 更新 tab.items
```

### 2. Split 终端（有问题）
```
Terminal.vue 点击 "+" → handleSplit() → appBusiness.splitSession() → API 创建子终端
→ 更新 main.children → 更新 tab.items → 但 UI 不响应
```

## 数据结构

### sessions 数组
```typescript
{
  id: "main-session-id",
  children: [{ id: "child-session-id", alive: true }],
  ...
}
```

### tabs[projectId].items 数组
```typescript
[
  { id: "main-session-id", type: "terminal", name: "主终端" },
  { id: "child-session-id", type: "terminal", name: "子终端 1" }
]
```

## 渲染逻辑

### Terminal.vue 模板
```vue
<div v-if="children && children.length > 0" class="sub-terminal-bar">
  <button class="sub-tab">主终端</button>
  <button v-for="child in children" class="sub-tab">
    子终端 {{ (children || []).indexOf(child) + 1 }}
  </button>
</div>
```

### 传入的 props
```vue
:children="appBusiness.getSessionChildren(item.id)"
```

## 可能的根因

1. **Vue 响应式问题**：reactive 对象中嵌套的数组（children）修改后，Vue 无法检测到变化

2. **两次 API 调用**：测试中发现双击项目时 `/api/terminals` 被调用了两次，可能存在重复调用导致的状态不一致

3. **appBusiness 对象导出问题**：Playwright 测试中 `window.appBusiness` 为空，可能是 module 作用域问题

## 待验证
- [ ] `appBusiness.splitSession` 是否正确更新了 `main.children`
- [ ] `appBusiness.getSessionChildren` 是否正确返回 `session.children`
- [ ] Vue 是否正确响应 children 数组的变化
- [ ] Terminal 组件是否接收到了正确的 children prop

## 测试日志输出（供参考）

```
[handleLaunch] project: c6a53e7b... test /tmp/test
[Network] 200 http://localhost:3001/api/terminals
  Response: {"sessionId":"4a6d2958-ec6c-4820-a0b7-73d1b64a2ee1"}
[handleLaunch] result: 4a6d2958-... tabs: 1 items: 1

App state after double-click: {}  ← window.appBusiness 为空
Project tabs: 1
Content tabs: 0  ← DOM 没有显示终端
Terminal wrappers: 0
```

## 建议下一步

1. 验证 `reactive` 是否正确代理了 `sessions` 数组的深层变化
2. 检查是否有其他地方覆盖了 `children` 数据
3. 使用 `Vue.set` 或替换整个数组来触发响应式更新
4. 简化架构：考虑 children 不存储在 session 内部，而是单独管理
