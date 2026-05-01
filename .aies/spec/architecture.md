# 架构规范

> 本文件定义项目的架构约束。**所有代码生成必须遵守**。

---

## 分层架构

### Electron + Vue 前端项目分层

```
┌──────────────────────────────────────────────────────────────┐
│  Vue 组件层（Renderer Process）                              │
│  职责：UI 渲染、用户交互、事件分发                            │
│  禁止：直接写业务逻辑、绕过 AppBusiness 直接调用 API          │
├──────────────────────────────────────────────────────────────┤
│  业务层（AppBusiness.ts）                                   │
│  职责：业务逻辑、数据编排、状态管理中枢                        │
│  禁止：直接操作 DOM、UI 细节                                  │
├──────────────────────────────────────────────────────────────┤
│  API 层（src/api/）                                         │
│  职责：HTTP/IPC 通信抽象，自动选择 HTTP（开发）或 IPC（打包）   │
│  禁止：业务逻辑                                              │
├──────────────────────────────────────────────────────────────┤
│  Electron 服务层（Main Process / electron/services/）       │
│  职责：系统级操作（PTY、文件、Git、项目持久化）                │
│  禁止：业务逻辑                                              │
└──────────────────────────────────────────────────────────────┘
```

### 依赖方向

**严格单向**：Vue 组件 → AppBusiness → API 层 → Electron 服务层

**严禁**：
- ❌ Vue 组件绕过 AppBusiness 直接调用 API
- ❌ AppBusiness 直接操作 Electron 主进程
- ❌ 业务逻辑写在 Vue 组件中

---

## 目录结构

```
ai-terminal/
├── src/                          # Vue 前端
│   ├── main.ts                  # 应用入口
│   ├── App.vue                  # 根组件
│   ├── components/              # Vue 组件（UI 层）
│   ├── store/                   # 业务层
│   │   └── AppBusiness.ts       # 核心业务逻辑单例
│   ├── api/                     # API 通信层
│   │   ├── index.ts            # 统一入口（HTTP/IPC 自动选择）
│   │   ├── http.ts             # HTTP 实现
│   │   └── electron-ipc.ts     # Electron IPC 实现
│   ├── utils/                  # 工具
│   │   └── EventBus.ts         # 事件总线
│   └── plugins/                # Vue 插件
│
├── electron/                     # Electron 主进程
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # 预加载脚本
│   └── services/              # 系统服务层
│       ├── PtyService.ts       # PTY 终端会话
│       ├── ProjectService.ts   # 项目管理
│       ├── FileService.ts      # 文件操作
│       └── GitService.ts       # Git 操作
│
└── server/                       # Node.js 后端（开发模式）
    ├── index.mjs               # Express + WebSocket
    └── services/               # 同 electron/services/
```

### 文件命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `ProjectList.vue`, `Terminal.vue` |
| 业务逻辑 | PascalCase + Business | `AppBusiness.ts` |
| API 模块 | kebab-case | `electron-ipc.ts`, `http.ts` |
| 类型定义 | 与文件名相同或内嵌 | `AppBusiness.ts` 内嵌类型 |
| Electron 服务 | PascalCase + Service | `PtyService.ts`, `ProjectService.ts` |

### 类/模块命名约定

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| Vue 组件 | PascalCase | `ProjectList`, `Terminal` |
| 业务单例 | PascalCase + Business | `AppBusiness` |
| EventBus 单例 | camelCase | `eventBus` |
| Electron 服务 | PascalCase + Service | `PtyService`, `ProjectService` |
| API 函数 | camelCase（带前缀） | `apiCreateTerminalSession`, `apiGetProjects` |

---

## 状态管理架构

**不使用 Pinia**，采用自定义单例 + EventBus 驱动模式：

```
AppBusiness（单例）
    │
    ├── 数据变更 → notify*() 方法 → EventBus.emit()
    │                                    │
    │                                    ▼
    │                              Vue 组件
    │                              (订阅事件)
    │                                    │
    └────────────────────────────────────┘
              事件通知循环
```

### 事件类型（AppEvents）

所有事件定义在 `AppBusiness.ts`，由 `eventBus` 统一分发：
- `PROJECTS_CHANGE` - 项目列表变化
- `SESSIONS_CHANGE` - 终端会话列表变化
- `EDITORS_CHANGE` - 编辑器列表变化
- `TABS_CHANGE` - 项目 Tab 变化
- `ACTIVE_PROJECT_CHANGE` - 当前项目变化
- `SETTINGS_CHANGE` - 设置变化
- `ACTIVITY_CHANGE` - 终端活跃度变化
- `SESSION_WAITING` - 终端需要人工干预
- `SESSION_FAILED` - 终端异常退出
- `INITIALIZED` - 初始化完成

---

## 依赖注入规范

本项目使用**构造函数注入 + 单例模式**：

```typescript
// AppBusiness 是全局单例
export const appBusiness = new AppBusinessClass()

// Vue 组件通过 import 使用
import { appBusiness, AppEvents } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
```

---

## 关键约束

### 约束 1：组件只做 UI 和事件分发

Vue 组件：
- 只处理 UI 渲染和用户交互
- 事件通过 `appBusiness.*` 方法分发到业务层
- 不直接修改状态

### 约束 2：业务逻辑集中在 AppBusiness

- 所有业务逻辑在 `AppBusiness.ts`
- 状态变更通过 `notify*()` 方法驱动 UI 更新
- 禁止在组件中写业务逻辑

### 约束 3：API 层统一入口

```
src/api/index.ts
    ├── HTTP 模式（开发模式）：src/api/http.ts
    └── IPC 模式（打包后）：src/api/electron-ipc.ts
```

### 约束 4：显式优于隐式

- 错误必须显式处理（try/catch + console.error）
- 配置必须显式加载（initialize() 中获取）
- 类型必须显式标注（TypeScript）

---

## 项目特定规范

### 1. 终端会话管理

- 每个项目可以有多个终端会话（`sessions` 数组）
- 每个会话可以有子终端（`children` 数组）
- 会话活跃度通过 `activityData` 跟踪（last + bytes）

### 2. Tab 管理

- `ProjectTab` 是项目的顶级容器
- `TabItem` 是具体的终端/编辑器/浏览器实例
- `tabs` 数组管理所有项目 Tab

### 3. Electron 双模式

- **开发模式**：Vue 浏览器 + Express 后端（HTTP/WebSocket）
- **打包模式**：Electron 应用 + IPC 通信
