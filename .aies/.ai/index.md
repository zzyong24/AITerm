# ai-terminal — 项目索引

> ⚠️ **维护规则**：每次新增/修改/删除文件后，必须同步更新本索引。
> 最后更新：2026-05-01

---

## 一、目录结构总览

```
ai-terminal/
├── README.md                 # 项目介绍
├── PROJECT_DOC.md           # 完整项目文档（含架构设计）
├── package.json             # 依赖、脚本、electron-builder 配置
├── tsconfig.json            # 主 TypeScript 配置
├── vite.config.ts           # Vite 构建配置
├── index.html               # 入口 HTML
├── src/                     # Vue 前端应用
│   ├── main.ts              # Vue 应用入口
│   ├── App.vue              # 根组件 - 整体布局
│   ├── style.css            # 全局样式 (VS Code 风格深色主题)
│   ├── components/          # Vue 组件
│   ├── store/              # 状态管理
│   │   └── AppBusiness.ts   # 核心业务逻辑类（单例 + EventBus 驱动）
│   ├── api/                # API 通信层（HTTP/IPSC 自动选择）
│   ├── utils/              # 工具函数（EventBus）
│   └── plugins/            # Vue 插件
├── electron/                # Electron 主进程
│   ├── main.ts             # 主进程入口
│   ├── preload.ts          # 预加载脚本
│   └── services/           # 主进程服务（PtyService、ProjectService、FileService、GitService）
├── server/                  # Node.js 后端服务（Express + WebSocket）
└── tests/                   # 测试
```

---

## 二、核心模块清单

| 模块 | 位置 | 职责 |
|------|------|------|
| AppBusiness | `src/store/AppBusiness.ts` | 核心业务逻辑单例，所有状态管理中枢 |
| EventBus | `src/utils/EventBus.ts` | 简单事件总线，驱动 Vue 组件响应式更新 |
| Terminal | `src/components/Terminal.vue` | xterm.js 终端组件 |
| ActivityPanel | `src/components/ActivityPanel.vue` | 终端活跃度状态面板 |
| ProjectList | `src/components/ProjectList.vue` | 侧边栏 - 项目列表/资源管理器/搜索/Git |
| ProjectContent | `src/components/ProjectContent.vue` | 项目内容区 - Tab 容器 |
| CodeEditor | `src/components/CodeEditor.vue` | CodeMirror 6 编辑器 |
| PtyService | `electron/services/PtyService.ts` | PTY 终端会话管理（node-pty） |
| ProjectService | `electron/services/ProjectService.ts` | 项目管理（持久化到 ~/.aiterm/projects.json） |
| API Layer | `src/api/` | HTTP（开发模式）/ IPC（打包后）自动选择 |

---

## 三、核心类型定义

```typescript
// 项目
interface Project {
  id: string
  name: string
  path: string
  group?: string
  git?: { isRepo: boolean; changesCount: number; ahead?: number; behind?: number }
}

// 终端会话
interface TerminalSession {
  id: string
  projectId: string | null
  projectName: string | null
  workingDir: string
  alive: boolean
  lastActivity: number
  children: ChildTerminal[]
  activeSubId: string | null
}

// 编辑器标签页
interface EditorTab {
  id: string
  projectId: string | null
  projectName: string | null
  path: string
  name: string
  content: string
  modified: boolean
}

// 项目 Tab（包含终端和编辑器）
interface ProjectTab {
  projectId: string
  projectName: string
  items: TabItem[]
  activeItemId: string | null
}

// Tab 项
interface TabItem {
  id: string
  type: 'terminal' | 'editor' | 'browser'
  name: string
  modified?: boolean
  path?: string
}
```

---

## 四、模块调用关系

```
用户操作（添加项目/创建终端/打开文件）
    ↓
Vue 组件（ProjectList.vue / ProjectContent.vue）
    ↓
AppBusiness（单例，核心业务逻辑中枢）
    ├── addProject()         → apiAddProject() → 持久化到 ~/.aiterm/projects.json
    ├── launchTerminal()     → createSession() → 创建 PTY 会话 + 添加 TabItem
    ├── openEditor()          → 创建 EditorTab + 添加 TabItem
    └── notify*() 方法        → eventBus.emit() → Vue 组件响应式更新
            ↓
      EventBus（事件总线）
            ↓
      Vue 组件（订阅事件，响应式更新 UI）
```

---

## 五、关键文件导航

| 场景 | 关键文件 |
|------|---------|
| 入口 | `src/main.ts` → `src/App.vue` |
| 核心业务逻辑 | `src/store/AppBusiness.ts` |
| 状态/事件驱动 | `src/utils/EventBus.ts` |
| 终端组件 | `src/components/Terminal.vue` |
| 编辑器组件 | `src/components/CodeEditor.vue` |
| 项目管理 | `electron/services/ProjectService.ts` |
| PTY 会话 | `electron/services/PtyService.ts` |
| API 层 | `src/api/index.ts`（HTTP/IPC 自动选择） |
| Electron 主进程 | `electron/main.ts` |
| 后端服务 | `server/index.mjs` |
| 单元测试 | `tests/AppBusiness.test.ts` |

---

## 六、事件类型（AppEvents）

| 事件 | 用途 |
|------|------|
| PROJECTS_CHANGE | 项目列表变化 |
| SESSIONS_CHANGE | 终端会话列表变化 |
| EDITORS_CHANGE | 编辑器列表变化 |
| TABS_CHANGE | 项目 Tab 变化 |
| ACTIVE_PROJECT_CHANGE | 当前项目变化 |
| SETTINGS_CHANGE | 设置变化 |
| ACTIVITY_CHANGE | 终端活跃度变化 |
| SESSION_WAITING | 终端需要人工干预 |
| SESSION_FAILED | 终端异常退出 |
| INITIALIZED | 初始化完成 |

---

## 七、变更日志

> 变更日志独立在 `.ai/changelog.md`，避免每次加载 index 都带上历史 diff（省 token）。
