# API 路由统一 - 问题追踪

## 问题描述

server/index.mjs（独立进程，port 5001）有完整 HTTP API + WebSocket，但 electron/main.ts 的 embedded server（port 5003）只有静态文件服务，没有 API 路由。前端 http.ts 硬编码 API 路径为 5001。

## 现状

| 场景 | 结果 |
|------|------|
| npm run dev (server/index.mjs + Vite) | 能跑但行为不一致，终端不显示，WebSocket 不通 |
| Electron 桌面端（5003） | API 全部失败，因为 embedded server 没有 API 路由 |

## 根本原因

electron/main.ts 的 startEmbeddedServer() 只做了静态文件服务和 SPA fallback，完全没有 API 路由。而 server/index.mjs 有 60+ 个 API 路由。

## 解决方案

把 server/index.mjs 的 API 路由提取为共享模块：

```
server/routes.mjs          ← 统一的 API 路由函数
    ↓
server/index.mjs           ← 加载 routes，给 standalone server 用
electron/main.ts           ← 加载 routes，给 embedded server 用
```

## 实现步骤

1. 创建 server/routes.mjs
   - 接收 app 和 services（ptyService, projectService, etc.）
   - 注册所有 API 路由
   - 管理 WebSocket 事件转发

2. 改造 server/index.mjs
   - 引入 routes.mjs，调用 registerRoutes(app, services)

3. 改造 electron/main.ts 的 startEmbeddedServer()
   - 在静态文件服务之前，先调用 registerRoutes(expressApp, services)
   - WebSocket 也走同一套，由 routes.mjs 管理

## 验收标准

1. npm run dev（backend + frontend）：终端显示、项目列表、WebSocket 正常
2. Electron 桌面端（5003）：所有功能与 standalone server 一致
3. 跨端数据持久化（SQLite）：两个客户端看到的数据一致