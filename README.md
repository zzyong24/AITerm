# AITerm

项目化终端管理器 — 基于 Electron + Vue 3 构建，将终端、代码编辑器、Git 操作和文件浏览整合进一个工作区。

## 功能特性

### 工作区管理
- **多项目管理** — 添加、删除、重命名项目，分组管理，快速切换工作区
- **跨端状态同步** — 多窗口/多客户端实时同步项目、终端、编辑器状态（SQLite + WebSocket）
- **持久化恢复** — 重启后自动还原上次的终端会话和编辑器标签

### 终端
- **多会话终端** — 基于 node-pty 的真实 PTY，每个项目独立多个终端标签
- **子终端** — 支持在会话内开启子终端，tab 切换
- **终端历史** — 保存/恢复终端历史记录
- **Kill Port** — 一键终止指定端口的进程

### 代码编辑
- **编辑器** — 基于 CodeMirror 6，支持语法高亮、多语言
- **文件树** — 目录浏览，右键菜单操作（新建/删除/复制/粘贴）
- **文件搜索** — 目录搜索 + 文件内容 grep 搜索

### Git 集成
- **状态面板** — 查看 staged/modified/untracked 文件，变更数实时显示
- **常用操作** — stage、unstage、discard、commit、push、pull
- **分支信息** — 显示当前分支及 ahead/behind 数量

### 工具栏
- **刷新项目列表** — 手动同步项目状态
- **清空记录** — 关闭所有终端会话，清空 SQLite 终端和编辑器记录（项目列表保留）
- **Kill Port** — 快速终止端口进程

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron 33 |
| 前端框架 | Vue 3 + TypeScript + Vite 6 |
| 终端 | xterm.js + node-pty |
| 代码编辑 | CodeMirror 6 |
| UI 组件 | Ant Design Vue |
| Git | simple-git |
| 持久化 | SQLite (better-sqlite3) |
| 进程通信 | Electron IPC / WebSocket（双模式） |

## 项目结构

```
AITerm/
├── src/                    # Vue 前端
│   ├── components/         # UI 组件
│   │   ├── WindowControls.vue   # 标题栏 + 工具按钮
│   │   ├── ProjectList.vue      # 项目侧边栏
│   │   ├── Terminal.vue         # 终端组件
│   │   ├── CodeEditor.vue       # 代码编辑器
│   │   ├── DirectoryTree.vue    # 文件树
│   │   ├── SearchPanel.vue      # 搜索面板
│   │   └── GitCommitDialog.vue  # Git 提交对话框
│   ├── store/
│   │   └── AppBusiness.ts       # 核心业务逻辑（状态管理）
│   ├── api/
│   │   ├── index.ts             # API 统一入口（自动选择 IPC / HTTP）
│   │   ├── electron-ipc.ts      # Electron IPC 适配器
│   │   └── http.ts              # HTTP 适配器（浏览器/开发模式）
│   └── utils/
├── electron/               # Electron 主进程
│   ├── main.ts             # 主进程 + IPC handlers
│   └── preload.ts          # 预加载脚本
└── server/                 # Node.js 后端（开发/Web 模式）
    ├── routes.mjs           # API 路由
    └── services/            # PTY / Project / DB / Git / File 服务
```

## 安装运行

```bash
# 安装依赖
npm install

# 开发模式（Electron + Vite HMR）
npm run dev

# 仅启动 Web 后端（浏览器调试）
npm run server

# 构建
npm run build

# 打包 macOS
npm run build:mac

# 打包 Windows
npm run build:win

# 运行测试
npm run test
```

## 双模式架构

AITerm 支持两种运行模式，`src/api/index.ts` 在运行时自动选择：

- **Electron IPC 模式**（打包后）— 前端通过 `window.electronAPI` 与主进程通信，零网络开销
- **HTTP / WebSocket 模式**（开发/浏览器）— 前端请求本地 Express 服务，适合快速调试

两套适配器实现相同的接口，业务层无感知切换。

## License

MIT
