# 验收标准：Electron 客户端暴露 HTTP 网页端

## P0 验收场景

| # | 场景描述 | 输入条件 | 期望结果 |
|---|---------|---------|---------|
| AC-01 | Electron 打包后启动，HTTP 服务器正常监听 | 启动 .app | `http://localhost:5002` 可访问，返回 Vue app HTML |
| AC-02 | BrowserWindow 加载内嵌服务器页面 | 启动 .app | 窗口内正常渲染 AITerm UI，功能正常 |
| AC-03 | 移动设备通过 Tailscale 访问 | 手机浏览器访问 `http://<tailnet-ip>:5002` | 完整 UI 可用，交互正常 |
| AC-04 | API 请求正确代理 | 移动端浏览器操作 | API 请求能正确到达 5001 server |
| AC-05 | dev 模式不受影响 | `npm run dev` + Electron | 仍加载 Vite dev server，不走 5002 |

## 验收方法

1. `npm run build:mac` 构建
2. 启动 Electron app（asar 内嵌模式）
3. `curl http://localhost:5002` 验证返回 HTML
4. 启动 Tailscale，验证手机访问 `http://<tailnet-ip>:5002`
5. `npm run dev` 启动，验证仍走 dev server

## P1 验收场景

| # | 场景描述 |
|---|---------|
| PC-01 | Electron 内嵌服务器与 5001 API server 同时运行无冲突 |
| PC-02 | 关闭 Electron，5002 端口正确释放 |