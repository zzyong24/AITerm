---
title: AITerm 开源项目维护手册
description: AITerm 开源项目的维护规范和操作指南
tags: [open-source, maintenance, AITerm]
created: 2026-05-04
modified: 2026-05-04
---

# AITerm 开源项目维护手册

> 本手册规范 AITerm 开源项目的维护流程，确保项目高质量迭代。

---

## 1. 项目信息

| 项目 | 信息 |
|------|------|
| **仓库地址** | https://github.com/zzyong24/AITerm |
| **官网** | https://zzyong24.github.io/AITerm |
| **npm 包** | aiterm |
| **许可证** | MIT |
| **Owner** | love张 |
| **核心开发** | zzyong24 |

---

## 2. Git 协作规范

### 分支策略

| 分支 | 用途 |
|------|------|
| `master` | 主分支，稳定版本 |
| `fix/*` | 修复分支 |
| `feat/*` | 功能分支 |

### Commit 规范

```
<type>: <subject>

<body>

<footer>
```

**Type 类型：**

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构 |
| `docs` | 文档更新 |
| `chore` | 构建/工具变更 |

**示例：**

```
feat: 添加 Kill Port 功能

- 新增 KillPortPanel 组件
- 集成端口进程查询和终止逻辑

Closes #123
```

---

## 3. 版本发布流程

### 3.1 构建步骤

```bash
# 安装依赖
npm install

# 运行测试
npm run test

# 构建 macOS (arm64)
npm run build:mac -- --arm64

# 构建 macOS (x64)
npm run build:mac -- --x64

# 构建 Windows
npm run build:win
```

### 3.2 打包输出

构建产物位于 `release/` 目录：

| 文件 | 说明 |
|------|------|
| `mac/AITerm.app` | macOS x64 应用 |
| `mac-arm64/AITerm.app` | macOS ARM64 应用 |
| `AITerm-mac.zip` | macOS x64 压缩包 |
| `AITerm-mac-arm64.zip` | macOS ARM64 压缩包 |

### 3.3 发布 GitHub Release

1. **登录 GitHub** → 进入 [Releases](https://github.com/zzyong24/AITerm/releases/new)

2. **创建 Tag**：`v0.1.0` 格式

3. **上传资产**：
   - 上传 `AITerm-mac.zip`
   - 上传 `AITerm-mac-arm64.zip`

4. **发布说明**：

```markdown
## AITerm v0.1.0

### 下载说明

| 平台 | 下载 |
|------|------|
| macOS (Intel) | AITerm-mac.zip |
| macOS (Apple Silicon) | AITerm-mac-arm64.zip |

### 新增功能

- 多终端管理
- 项目管理
- 代码编辑
- Git 集成
- 跨端状态同步

### 安装方法

1. 解压 zip 文件
2. 将 AITerm.app 拖入应用程序文件夹
3. 首次运行可能需要在系统偏好设置中允许
```

---

## 4. npm 发包流程

### 4.1 登录 npm

```bash
npm login
```

### 4.2 发布

```bash
# 确认版本号
npm version patch  # 0.1.0 -> 0.1.1

# 发布
npm publish
```

### 4.3 安装测试

```bash
npm install -g aiterm
aiterm --version
```

---

## 5. 文档更新

### 5.1 落地页更新

落地页位于 `docs/index.html`，更新后部署到 GitHub Pages：

1. 修改 `docs/index.html`
2. 推送后 GitHub Actions 自动部署

### 5.2 README 更新

参考 `aiengineeringfromscratch.com` 风格，保持：

- Badge 徽章
- 功能介绍表格
- 技术栈列表
- 安装命令
- 团队信息

---

## 6. 问题处理

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| 构建失败 | `npm install` 重新安装依赖 |
| node-pty 编译失败 | `npm run postinstall` |
| 应用启动闪退 | 检查 `release/` 目录完整性 |

### Bug 修复流程

```
1. 创建 fix/* 分支
2. 修复问题
3. 提交并推送
4. 合并到 master
5. 打 tag 发布
```

---

## 7. GitHub Pages 部署

落地页部署在 `docs/` 目录：

1. 推送代码到 GitHub
2. Settings → Pages → Source: `main` / `docs` folder
3. 访问 `https://zzyong24.github.io/AITerm`

---

## 8. 核心命令速查

```bash
# 安装
npm install

# 开发
npm run dev

# 构建
npm run build
npm run build:mac
npm run build:win

# 测试
npm run test

# 发版
npm version patch
npm publish
```