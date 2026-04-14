# AITerm

多终端管理器 - 基于 Electron + Vue 的项目化终端和代码编辑器。

## 功能特性

- **多项目管理** - 添加、删除、重命名项目，轻松切换工作区
- **终端模拟** - 基于 node-pty 的真实终端，支持多会话
- **代码编辑** - 基于 CodeMirror 6 的代码编辑器
- **Git 集成** - 查看状态、提交、推送、拉取等操作
- **目录浏览** - 文件树导航，快速定位项目文件
- **项目搜索** - 目录搜索和文件内容搜索

## 技术栈

- Electron 33 + Vue 3 + TypeScript
- Vite 6 构建工具
- xterm.js 终端模拟
- CodeMirror 6 代码编辑
- simple-git Git 操作
- Ant Design Vue UI

## 项目结构

```
aiterm/
├── src/                 # Vue 前端应用
│   ├── components/       # Vue 组件
│   ├── store/           # 业务逻辑
│   ├── api/             # API 接口
│   └── utils/           # 工具函数
├── electron/            # Electron 主进程
│   ├── main.ts          # 主进程入口
│   ├── preload.ts       # 预加载脚本
│   └── services/        # 主进程服务
└── server/              # Node.js 后端服务
    └── services/        # 后端服务
```

## 安装运行

```bash
# 安装依赖
npm install

# 开发模式（同时启动前端和后端）
npm run dev

# 构建应用
npm run build

# 打包 macOS 应用
npm run build:mac

# 打包 Windows 应用
npm run build:win

# 运行测试
npm run test
```

## License

MIT
