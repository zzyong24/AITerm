# 浏览器模式WebSocket端口连接错误

## 需求背景

`src/api/http.ts` 中 WebSocket 地址构造如下：

```ts
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
```

在浏览器开发模式（Vite dev server，端口 5173）下，`window.location.host` 为 `localhost:5173`，所以 WS 会连接到 `ws://localhost:5173/ws`。

但实际的 WebSocket 服务端运行在 **端口 5002**（`server/index.mjs` 中 `PORT = 5001`，WS 绑定在 `PORT+1`）。

结果：浏览器模式下 WebSocket 永远连不上，所有终端输出、状态广播均无法接收。

Vite 的代理配置（`vite.config.ts`）目前只代理 HTTP 请求到 5001，没有代理 WebSocket 到 5002。

## 涉及文件

- `src/api/http.ts` — `WS_BASE` 构造逻辑
- `vite.config.ts` — Vite 代理配置（需要添加 WS 代理）

## 技术方案

### 方案 A：Vite proxy 代理 WebSocket（推荐）

在 `vite.config.ts` 中添加 WebSocket 代理，将 `/ws` 升级转发到 5002：

```ts
proxy: {
  '/api': { target: 'http://localhost:5001', changeOrigin: true },
  '/ws': {
    target: 'ws://localhost:5002',
    ws: true,
    changeOrigin: true,
  },
}
```

`http.ts` 的 `WS_BASE` 保持不变（继续用 `window.location.host`），通过 Vite 代理透明转发。

### 方案 B：HTTP 服务和 WS 服务合并到同一端口

把 WS 挂在与 HTTP 同一端口（5001），`/ws` 路径升级，这样无需代理。但改动较大。

推荐方案 A，改动最小、不影响生产打包。

## 优先级

P1 — 浏览器模式（5173）下终端输出完全不可用，但 Electron 模式不受影响。
