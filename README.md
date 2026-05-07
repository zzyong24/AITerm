<div align="center">

<img src="assets/banner.svg" alt="AITerm" width="100%">

# 🖥️ AITerm

### *多终端管理器 — 基于 Electron + Vue 的现代化开发环境。*

<!-- Primary badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-A8E6CF?style=for-the-badge&labelColor=0D1117)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-FF8B94?style=for-the-badge&labelColor=0D1117)](CONTRIBUTING.md)
[![Version](https://img.shields.io/badge/Version-0.1.0-FFD93D?style=for-the-badge&labelColor=0D1117)](package.json)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-6BCB77?style=for-the-badge&labelColor=0D1117)](#)
[![Stars](https://img.shields.io/github/stars/zzyong24/AITerm?style=for-the-badge&labelColor=0D1117&color=FFC75F)](https://github.com/zzyong24/AITerm/stargazers)

<!-- Tech stack badges -->
[![Electron](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white)](#)
[![Vue](https://img.shields.io/badge/Vue_3-4DBB9F?style=flat-square&logo=vue.js&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
[![xterm.js](https://img.shields.io/badge/xterm.js-4D96FF?style=flat-square&logo=xterm&logoColor=white)](#)
[![CodeMirror](https://img.shields.io/badge/CodeMirror_6-6BCB77?style=flat-square&logo=codemirror&logoColor=white)](#)
[![SQLite](https://img.shields.io/badge/SQLite-4479A1?style=flat-square&logo=sqlite&logoColor=white)](#)
[![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=flat-square&logo=websocket&logoColor=white)](#)

### 🧭 快速导航

[**🚀 快速开始**](#-getting-started) &nbsp;·&nbsp;
[**✨ 核心功能**](#-核心功能) &nbsp;·&nbsp;
[**🏗️ 技术架构**](#-技术架构) &nbsp;·&nbsp;
[**🛠️ 安装运行**](#-安装运行) &nbsp;·&nbsp;
[**🤝 贡献指南**](CONTRIBUTING.md) &nbsp;·&nbsp;
[**🌐 官网**](https://zzyong24.github.io/AITerm)

</div>

---

<div align="center">

> ### 💬 *"一个工具，终端 + 编辑器 + Git + 文件浏览全搞定。"*

</div>

**AITerm** 是一款基于 Electron + Vue 3 构建的**多终端管理器**，将终端、代码编辑器、Git 操作和文件浏览整合进一个工作区。支持跨端状态同步，重启后自动还原终端会话和编辑器状态。

<br/>

### 🆚 为什么选择 AITerm？

<table>
<tr>
<th width="33%">🔧 传统方式</th>
<th width="33%">🖥️ AITerm</th>
</tr>
<tr>
<td><b>终端</b><br/>iTerm / Terminal 分屏切换</td>
<td><b>终端</b><br/>🖥️ 真实 PTY，多会话 Tab，内置窗口管理</td>
</tr>
<tr>
<td><b>编辑器</b><br/>VS Code / Vim 分屏</td>
<td><b>编辑器</b><br/>⚡ 内置 CodeMirror，多语言高亮，无需切换</td>
</tr>
<tr>
<td><b>Git</b><br/>Tower / SourceTree / 命令行切换</td>
<td><b>Git</b><br/>🔀 状态面板 + 常用操作，编辑器内完成</td>
</tr>
<tr>
<td><b>文件管理</b><br/>Finder / 命令行切换</td>
<td><b>文件管理</b><br/>📁 内置目录树，右键菜单操作</td>
</tr>
<tr>
<td><b>状态持久化</b><br/>手动恢复，重启丢失</td>
<td><b>状态持久化</b><br/>💾 跨端同步，重启后自动还原</td>
</tr>
<tr>
<td><b>多项目管理</b><br/>多窗口切换</td>
<td><b>多项目管理</b><br/>📋 统一侧边栏，分组管理</td>
</tr>
</table>

---

<div align="center">

## ✨ 核心功能

</div>

### 🖥️ 多终端管理
- 基于 **node-pty** 的真实 PTY 终端，不是模拟
- 每个项目独立多个终端标签
- 子终端 Tab 切换
- 终端历史保存/恢复

### 📁 项目管理
- 多项目管理（添加/删除/重命名/分组）
- **跨端状态同步**（SQLite + WebSocket）
- 持久化恢复，重启后还原终端/编辑器状态

### ⚡ 代码编辑
- 基于 **CodeMirror 6** 的编辑器
- 多语言语法高亮
- 目录树浏览 + 右键菜单（新建/删除/复制/粘贴）
- 文件搜索 + 内容 grep

### 🔀 Git 集成
- 状态面板（staged / modified / untracked）
- 常用操作：stage / unstage / discard / commit / push / pull
- 分支信息显示（ahead / behind 数量）

### 🔌 开发工具集
- **Kill Port** — 一键终止端口进程
- 刷新项目列表
- 清空记录（关闭所有终端会话）

---

<div align="center">

## 🏗️ 技术架构

</div>

### 跨端状态同步架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Electron  │────▶│   SQLite    │◀───▶│  WebSocket  │
│  (桌面壳)    │     │  (本地持久化) │     │  (状态同步)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │  多端一致    │
                                         │ (Server-as-SSOT)
                                         └─────────────┘
```

### 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron 33 |
| 前端框架 | Vue 3 + TypeScript + Vite 6 |
| 终端 | xterm.js + node-pty |
| 代码编辑 | CodeMirror 6 |
| UI 组件 | Ant Design Vue 4 |
| Git | simple-git |
| 持久化 | SQLite (better-sqlite3) |
| 进程通信 | Electron IPC / WebSocket（双模式） |

---

<div align="center">

## 🚀 快速开始

</div>

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

> 启动 Electron + Vite HMR，开发时支持热更新

### 构建

```bash
# 构建前端 + Electron
npm run build

# 打包 macOS
npm run build:mac

# 打包 Windows
npm run build:win
```

### 运行测试

```bash
npm run test
```

---

<div align="center">

## 📁 项目结构

</div>

```
AITerm/
├── src/                    # Vue 前端
│   ├── components/         # UI 组件
│   │   ├── WindowControls.vue   # 标题栏 + 工具按钮
│   │   ├── ProjectList.vue      # 项目侧边栏
│   │   ├── Terminal.vue         # 终端组件
│   │   ├── TerminalPanel.vue    # 终端面板
│   │   ├── CodeEditor.vue       # 代码编辑器
│   │   ├── DirectoryTree.vue    # 文件树
│   │   ├── SearchPanel.vue      # 搜索面板
│   │   └── GitCommitDialog.vue  # Git 提交对话框
│   ├── store/
│   │   └── AppBusiness.ts       # 核心业务逻辑
│   ├── api/
│   │   ├── index.ts             # API 统一入口
│   │   ├── electron-ipc.ts       # Electron IPC 适配器
│   │   └── http.ts              # HTTP 适配器
│   └── utils/
├── electron/               # Electron 主进程
│   ├── main.ts             # 主进程 + IPC handlers
│   └── preload.ts          # 预加载脚本
└── server/                 # Node.js 后端
    ├── index.mjs           # 入口
    ├── routes.mjs         # API 路由
    └── services/           # PTY / Project / DB / Git / File 服务
```

---

<div align="center">

## 🤝 双模式架构

</div>

AITerm 支持两种运行模式，`src/api/index.ts` 在运行时自动选择：

| 模式 | 适用场景 | 通信方式 |
|------|---------|---------|
| **Electron IPC** | 打包后 | `window.electronAPI` 直接调用主进程 |
| **HTTP / WebSocket** | 开发 / 浏览器调试 | 请求本地 Express 服务 |

两套适配器实现相同接口，业务层无感知切换。

---

<div align="center">

## 👥 团队

</div>

| 开发者 | 角色 |
|--------|------|
| [love张](https://github.com/lovezhang) | Owner |
| [zzyong24](https://github.com/zzyong24) | 核心开发 |

---

<div align="center">

## 📄 License

MIT License — 详见 [LICENSE](LICENSE)

</div>