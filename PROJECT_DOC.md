# AITerm 项目文档

## 项目概述

- **项目名称**: AITerm
- **版本**: 0.1.0
- **描述**: 多终端管理器 - 基于 Electron + Vue 的项目化终端和代码编辑器
- **技术栈**: Electron + Vue 3 + TypeScript + Vite + Express + node-pty + xterm.js + CodeMirror 6

---

## 目录结构

```
aiterm/
├── package.json              # 项目依赖、脚本命令、electron-builder 配置
├── tsconfig.json             # 主 TypeScript 配置 (Vue 前端)
├── tsconfig.node.json        # Node.js TypeScript 配置 (vite.config.ts)
├── tsconfig.electron.json     # Electron TypeScript 配置 (electron/ 目录)
├── vite.config.ts            # Vite 构建配置
├── index.html                # 入口 HTML
├── icon.icns                 # macOS 应用图标

├── src/                      # ===== Vue 前端应用 =====
│   ├── main.ts               # Vue 应用入口
│   ├── App.vue               # 根组件 - 整体布局
│   ├── style.css             # 全局样式 (VS Code 风格深色主题)
│   ├── vite-env.d.ts         # Vite 类型声明
│   │
│   ├── components/           # Vue 组件
│   │   ├── WindowControls.vue    # 窗口控制按钮 (最小化/最大化/关闭)
│   │   ├── ProjectList.vue       # 侧边栏 - 项目列表/资源管理器/搜索/Git面板
│   │   ├── ProjectContent.vue    # 项目内容区 - 终端和编辑器的 Tab 容器
│   │   ├── Terminal.vue          # xterm.js 终端组件
│   │   ├── CodeEditor.vue        # CodeMirror 6 代码编辑器
│   │   ├── DirectoryTree.vue    # 目录树组件
│   │   ├── ActivityPanel.vue     # 终端活跃度状态面板
│   │   ├── Settings.vue          # 设置弹窗 (编辑器路径配置)
│   │   ├── ConfirmDialog.vue     # 确认对话框
│   │   └── MessageBox.vue        # 消息框组件 (alert/confirm/prompt)
│   │
│   ├── store/                # 状态管理
│   │   └── AppBusiness.ts    # 核心业务逻辑类 (非 Pinia，自定义 EventBus 驱动)
│   │
│   ├── api/                  # API 通信层
│   │   ├── index.ts          # 统一 API 入口 - 自动选择 HTTP 或 IPC
│   │   ├── http.ts           # HTTP API 实现 (开发模式)
│   │   └── electron-ipc.ts   # Electron IPC API 实现 (打包后)
│   │
│   ├── utils/                # 工具函数
│   │   └── EventBus.ts       # 简单的事件总线实现
│   │
│   └── plugins/              # Vue 插件
│       └── MessageBox.ts     # 动态渲染 MessageBox 组件的插件
│
├── electron/                 # ===== Electron 主进程 =====
│   ├── main.ts               # Electron 主进程入口
│   ├── preload.ts            # 预加载脚本 - 暴露 electronAPI 到渲染进程
│   ├── node-pty.d.ts         # node-pty 模块的类型声明
│   └── services/             # Electron 环境的服务
│       ├── PtyService.ts     # PTY 终端会话管理 (使用 node-pty)
│       ├── ProjectService.ts # 项目管理 (持久化到 ~/.aiterm/projects.json)
│       ├── FileService.ts    # 文件操作服务
│       └── GitService.ts     # Git 操作服务 (使用 simple-git)
│
├── server/                   # ===== Node.js 后端服务 =====
│   ├── index.mjs             # Express 服务器入口 (HTTP API + WebSocket)
│   └── services/             # Node.js 环境的服务
│       ├── PtyService.mjs    # 与 electron/services/PtyService.ts 类似
│       ├── ProjectService.mjs# 项目管理服务
│       ├── FileService.mjs   # 文件操作服务
│       └── GitService.mjs    # Git 操作服务
│
└── tests/                    # 测试
    └── AppBusiness.test.ts   # AppBusiness 单元测试 (使用 vitest)
```

---

## 核心设计思想：基于项目来管理终端和编辑器

### 核心理念

AITerm 的核心设计理念是**将终端和编辑器与项目绑定**。每个项目拥有自己独立的终端和编辑器实例，而非全局管理。

### 数据层次结构

```
AppBusiness (单例 - 核心业务逻辑)
├── projects: Project[]              # 所有已添加的项目列表
├── tabs: ProjectTab[]                # 所有打开的项目 Tab
│   └── ProjectTab {
│       projectId: string              # 项目 ID
│       projectName: string            # 项目名称
│       items: TabItem[]               # 该项目的所有终端和编辑器
│       activeItemId: string | null   # 当前激活的项 ID
│   }
│       └── TabItem {
│           id: string                 # 终端 sessionId 或编辑器 editorId
│           type: 'terminal' | 'editor' # 类型
│           name: string               # 显示名称
│           modified?: boolean         # 是否已修改 (编辑器)
│           path?: string              # 文件路径 (编辑器)
│       }
├── sessions: TerminalSession[]       # 所有终端会话
└── editors: EditorTab[]               # 所有编辑器标签页
```

### UI 层次结构

```
App.vue
├── WindowControls (窗口控制按钮)
├── sidebar: ProjectList (侧边栏)
│   ├── 项目列表 (explorer 面板)
│   ├── 搜索 (search 面板)
│   └── Git (git 面板)
└── main-content: ProjectContent[]
    ├── project-tabs (项目标签栏 - 切换不同项目)
    ├── project-path (项目路径显示)
    └── content-area (项目内容区)
        ├── content-tabs (终端/编辑器标签栏)
        └── content-container (终端或编辑器组件)
```

### 关键类型定义 (AppBusiness.ts)

```typescript
// 项目
interface Project {
  id: string
  name: string
  path: string
  group?: string
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

// 项目 Tab (包含终端和编辑器)
interface ProjectTab {
  projectId: string
  projectName: string
  items: TabItem[]       # 终端和编辑器混合列表
  activeItemId: string | null
}

// Tab 项
interface TabItem {
  id: string
  type: 'terminal' | 'editor'
  name: string
  modified?: boolean
  path?: string
}
```

### 状态管理架构

**不使用 Pinia**，而是采用自定义的 `AppBusiness` 单例类 + `EventBus` 事件驱动模式：

```
AppBusiness (单例)
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

**事件类型 (AppEvents)**:
- `PROJECTS_CHANGE` - 项目列表变化
- `SESSIONS_CHANGE` - 终端会话列表变化
- `EDITORS_CHANGE` - 编辑器列表变化
- `TABS_CHANGE` - 项目 Tab 变化
- `ACTIVE_PROJECT_CHANGE` - 当前项目变化
- `SETTINGS_CHANGE` - 设置变化
- `ACTIVITY_CHANGE` - 终端活跃度变化
- `INITIALIZED` - 初始化完成

### 核心业务流程

#### 1. 添加项目 → 启动终端

```
用户点击"+"添加项目
    ↓
ProjectList.handleAdd() → appBusiness.addProject()
    ↓
apiAddProject() → 持久化到 ~/.aiterm/projects.json
    ↓
用户点击项目 → 选择"创建终端"
    ↓
ProjectList.handleLaunchTerminal() → appBusiness.launchTerminal()
    ↓
1. createSession() → 创建 PTY 会话
2. 确保 ProjectTab 存在
3. 添加 TabItem (type: 'terminal')
4. 切换到该 Tab
    ↓
ProjectContent 检测到 activeItemId 变化
    ↓
显示 Terminal.vue 组件
```

#### 2. 打开文件 → 编辑器

```
用户右键文件 → 选择"编辑"
    ↓
ProjectList.handleEditFile() → apiReadFile(filePath)
    ↓
App.vue.handleOpenEditor() → appBusiness.openEditor()
    ↓
1. 检查该文件是否已打开 (防止重复)
2. 创建 EditorTab
3. 添加到 ProjectTab.items
4. 切换到该 Tab
    ↓
ProjectContent 检测到 activeItemId 变化
    ↓
显示 CodeEditor.vue 组件
```

#### 3. 切换项目 Tab

```
用户点击不同的项目 Tab
    ↓
App.vue.handleSwitchProject(projectId)
    ↓
appBusiness.switchProjectTab(projectId)
    ↓
emit ACTIVE_PROJECT_CHANGE
    ↓
App.vue 检测到 activeProjectId 变化
    ↓
v-show 显示对应的 ProjectContent
```

### 关键文件说明

#### 前端核心

| 文件 | 用途 | 关键代码 |
|------|------|---------|
| `AppBusiness.ts` | 核心业务逻辑类，所有状态管理中枢 | `appBusiness.launchTerminal()`, `appBusiness.openEditor()` |
| `App.vue` | 根组件，布局管理 | `handleSwitchProject()`, `handleLaunch()` |
| `ProjectList.vue` | 侧边栏，项目管理和导航 | 项目列表、目录树、搜索、Git 面板 |
| `ProjectContent.vue` | 项目内容区，终端/编辑器容器 | 显示活跃项目的所有 Tab |

#### 业务逻辑入口

| 方法 | 文件 | 用途 |
|------|------|------|
| `launchTerminal()` | AppBusiness.ts | 为项目创建新终端 |
| `openEditor()` | AppBusiness.ts | 在项目中打开文件编辑器 |
| `createSession()` | AppBusiness.ts | 创建 PTY 会话 |
| `closeSession()` | AppBusiness.ts | 关闭终端会话 |
| `closeEditor()` | AppBusiness.ts | 关闭编辑器 |
| `switchProjectTab()` | AppBusiness.ts | 切换项目 Tab |
| `closeProjectTab()` | AppBusiness.ts | 关闭项目 Tab (关闭所有关联终端和编辑器) |

#### API 层

| 文件 | 用途 | 环境 |
|------|------|------|
| `api/index.ts` | 统一入口，自动选择 HTTP 或 IPC | 通用 |
| `api/http.ts` | HTTP API 调用 | 开发模式 / 浏览器 |
| `api/electron-ipc.ts` | Electron IPC 调用 | 打包后 |

---

## 开发指南

### 启动开发服务器

```bash
# 安装依赖
npm install

# 启动前端开发服务器 (端口 5173)
npm run dev

# 同时需要启动后端服务 (另一个终端)
cd server && node index.mjs
```

### 项目结构概览图

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron 打包应用                         │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Main Process   │    │     Renderer Process (Vue)      │ │
│  │                 │    │                                 │ │
│  │  - PtyService   │◄───┤  ┌─────────┐  ┌──────────────┐  │ │
│  │  - ProjectService│ IPC │  │  App    │  │ Terminal.vue│  │ │
│  │  - FileService   │    │  │Business │◄─│ (xterm.js)  │  │ │
│  │  - GitService    │    │  │(EventBus)│  └──────────────┘  │ │
│  │                 │    │  └────┬────┘  ┌──────────────┐  │ │
│  │  preload.ts ────┼────┼────────┼──────│CodeEditor.vue│  │ │
│  │  (electronAPI)  │    │        │      │(CodeMirror)  │  │ │
│  └─────────────────┘    │        │      └──────────────┘  │ │
│                          │  ┌─────┴─────┐  ┌──────────────┐ │ │
│                          │  │ProjectList│  │DirectoryTree│ │ │
│                          │  │           │  │             │ │ │
│                          │  └───────────┘  └──────────────┘ │ │
│                          └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

开发模式:
┌──────────────────┐    HTTP/WebSocket    ┌──────────────────┐
│  Vue (Browser)   │◄──────────────────►│  Express Server   │
│  localhost:5173  │                     │  localhost:3001   │
│                  │                     │  + WebSocket :3002│
└──────────────────┘                     └──────────────────┘
```

---

## 快速定位指南

| 需要修改的功能 | 关键文件 | 说明 |
|---------------|---------|------|
| 添加新项目流程 | `ProjectList.vue` → `AppBusiness.addProject()` | 项目添加到侧边栏 |
| 终端创建 | `AppBusiness.launchTerminal()` | 创建 PTY 会话并添加到 Tab |
| 编辑器打开 | `AppBusiness.openEditor()` | 打开文件到编辑器 Tab |
| 项目切换 | `App.vue.handleSwitchProject()` | 切换 ProjectTab |
| 终端组件 | `Terminal.vue` | xterm.js 渲染 |
| 编辑器组件 | `CodeEditor.vue` | CodeMirror 6 渲染 |
| API 通信 | `api/index.ts` | HTTP/IPC 自动选择 |
| Electron 主进程 | `electron/main.ts` | 窗口创建、IPC handlers |
| 后端服务 | `server/index.mjs` | Express + WebSocket |

---

## 依赖库

| 类别 | 库名 | 用途 |
|------|------|------|
| 前端框架 | vue, ant-design-vue | UI 框架 |
| 终端 | @xterm/xterm, @xterm/addon-fit | Web 终端模拟器 |
| 编辑器 | @codemirror/view, @codemirror/state, etc. | 代码编辑器 |
| Electron | electron, electron-builder, electron-log | 桌面应用框架 |
| 后端 | express, cors, ws | HTTP/WebSocket 服务器 |
| 终端模拟 | node-pty | PTY 伪终端 |
| Git | simple-git | Git 操作 |
| 测试 | vitest, @vue/test-utils, playwright | 单元测试/E2E |
| 构建 | vite, typescript | 前端构建 |
