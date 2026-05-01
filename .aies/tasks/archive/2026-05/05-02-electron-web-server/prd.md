# Electron 客户端暴露 HTTP 网页端实现三端互通

## 需求背景

通过 Tailscale 内网穿透，让手机、平板等移动设备也能通过浏览器访问 AITerm Electron 客户端，从而实现三端互通。

当前架构：
- Electron 端：`file://` 加载本地 HTML
- Web 端：独立 Vite dev server / 部署服务器
- 手机端：无法访问 Electron 内部

目标架构：
- Electron 启动时内嵌一个 Express HTTP 服务器 serving Vue build 产物
- BrowserWindow 加载 `http://localhost:WEB_PORT`
- 通过 Tailscale Tailnet IP 暴露 WEB_PORT，手机浏览器直接访问

## 核心目标

Electron 打包后启动时，自动启动一个 HTTP 服务器 serving 前端 UI，三端可通过 Tailscale 互通。

## 技术方案

### 文件结构
- Vue build 产物在 `dist/`，打包进 `app.asar` 或 `extraResources`
- Electron main process 启动内嵌 Express 服务器（端口 5002）
- 服务 static 文件 + API 代理（复用现有 server 逻辑）

### 实现要点
1. **内嵌 HTTP 服务器**：Electron main process 启动 Express，`app.getAppPath()` 取 asar 内的 `dist/`
2. **加载 URL 切换**：`process.env.VITE_DEV_SERVER_URL` 时仍用 dev server，否则用 `http://localhost:5002`
3. **API 处理**：复用 `server/index.mjs` 的 Express 路由逻辑（或直接代理到 5001）
4. **端口分配**：
   - 5001: 独立 server（现有）
   - 5002: Electron 内嵌 web 服务器
5. **打包资源**：通过 `electron-builder` 的 `extraResources` 或 asar 解压访问 `dist/`

### 影响范围
- 修改文件：`electron/main.ts`（新增内嵌服务器启动逻辑）
- 新增文件：`electron/EmbeddedServer.ts`（可选，封装服务器逻辑）

## 不确定点

1. **asar vs extraResources**：`app.getAppPath()` 在 asar 内访问 `dist/` 是否会有权限/路径问题？
   → 方案：优先 asar 解压模式，或用 `process.resourcesPath` + `extraResources`

2. **API 端**：复用现有 5001 server 逻辑，还是 Electron 端也启动一套 API？
   → 方案：Electron 只 serve 前端静态文件，API 统一走 5001（手机/网页端都要连接 5001）