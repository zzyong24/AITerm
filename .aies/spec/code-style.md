# 代码风格规范

> 本文件定义项目的代码风格。AI 生成代码必须遵循。

---

## 命名规范

### 通用原则

- **语义清晰 > 简短**：`userRepository` > `ur`
- **避免歧义词**：不用 `data`、`info`、`obj`、`temp`
- **专有名词保持大小写**：`userId`（TypeScript）

### 按类型命名

| 类型 | 规则 | 示例 |
|------|-----|------|
| 常量 | UPPER_SNAKE_CASE | `MAX_HISTORY_ENTRIES` |
| 变量/函数 | camelCase | `createSession`, `terminalFontSize` |
| 类/组件 | PascalCase | `AppBusiness`, `ProjectList` |
| 接口/类型 | PascalCase | `TerminalSession`, `ProjectTab` |
| 事件类型 | PascalCase（AppEvents） | `PROJECTS_CHANGE`, `SESSION_WAITING` |
| Vue 文件 | PascalCase | `Terminal.vue`, `ActivityPanel.vue` |
| 目录 | kebab-case | `electron/services/` |

---

## 注释规范

### 结构体 / 接口字段必须有结构化注释

格式：`含义 + 类型 + 默认值 + 约束`

✅ 正确：
```typescript
// id 会话 ID，用于标识唯一的 PTY 会话
id: string

// workingDir 工作目录。格式：绝对路径或 ~ 表示 home 目录
workingDir: string

// children 子终端数组，支持终端拆分
children: ChildTerminal[]

// alive 终端是否存活。false 表示已退出
alive: boolean
```

### 函数注释

使用 JSDoc 格式：

```typescript
/**
 * createSession 创建终端会话
 * @param projectId 项目 ID（可选，无项目则为全局终端）
 * @param projectName 项目名称
 * @param workingDir 工作目录
 * @returns sessionId 新建的会话 ID
 */
async createSession(projectId: string | null, projectName: string | null, workingDir?: string): Promise<string>
```

---

## 禁止模式

### ❌ 禁止 1：魔法数字

```typescript
// ❌ 错误
if (this.historyEntries.length > 500) { ... }

// ✅ 正确：使用有名字的常量
const MAX_HISTORY_ENTRIES = 500
if (this.historyEntries.length > MAX_HISTORY_ENTRIES) { ... }
```

### ❌ 禁止 2：静默吞掉错误

```typescript
// ❌ 错误
_ = someFunc()

// ✅ 正确
const result = someFunc()
if (!result) {
    console.error('someFunc failed')
}
```

### ❌ 禁止 3：any 类型滥用

```typescript
// ❌ 错误
const data: any = response

// ✅ 正确：使用具体类型或 unknown
const data: ResponseType = response
```

### ❌ 禁止 4：硬编码敏感信息

```typescript
// ❌ 错误
const apiKey = 'my-secret-key-123'

// ✅ 正确：从配置或环境变量获取
const apiKey = process.env.API_KEY
```

---

## 必须模式

### ✅ 必须 1：接口/类型定义使用 TypeScript

```typescript
// ✅ 正确
interface Project {
    id: string
    name: string
    path: string
    group?: string
}

// ❌ 错误：使用 Object 或 any
const project: any = { ... }
```

### ✅ 必须 2：Vue 组件使用 defineComponent

```typescript
import { defineComponent } from 'vue'

export default defineComponent({
    name: 'Terminal',
    props: {
        sessionId: { type: String, required: true }
    },
    // ...
})
```

### ✅ 必须 3：emit 事件类型声明

```typescript
emits: ['active-sub-change']
```

### ✅ 必须 4：组件数据使用 data() 返回

```typescript
data() {
    return {
        terminal: null as XTerm | null,
        fitAddon: null as FitAddon | null
    }
}
```

---

## 函数长度限制

- 单个函数 ≤ 100 行
- 超过时拆分为子函数
- 单行长度 ≤ 120 字符

---

## Vue 组件规范

### 组件结构顺序

1. `<template>` - HTML 结构
2. `<script lang="ts">` - 逻辑
3. `<style scoped>` - 样式（使用 scoped）

### Props 定义

```typescript
props: {
    sessionId: {
        type: String,
        required: true
    },
    workingDir: {
        type: String,
        default: '~'
    },
    isActive: {
        type: Boolean,
        default: false
    }
}
```

### Emit 定义

```typescript
emits: ['active-sub-change', 'close', 'split']
```

---

## 项目特定风格

### 1. EventBus 使用

```typescript
import { eventBus } from '../utils/EventBus'
import { AppEvents } from '../store/AppBusiness'

// 订阅
eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)

// 取消订阅（beforeUnmount 中）
eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
```

### 2. AppBusiness 单例使用

```typescript
import { appBusiness, AppEvents } from '../store/AppBusiness'

// 直接调用业务方法
appBusiness.launchTerminal(projectId, projectName)

// 订阅事件监听状态变化
eventBus.on(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
```

### 3. API 层调用

```typescript
import { apiGetProjects } from '../api'

// API 调用（通常在 async 方法中）
const projects = await apiGetProjects()
```
