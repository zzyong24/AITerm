# 验收与测试：浏览器模式WebSocket端口连接错误

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 操作 | 期望结果 |
|---|------|------|--------|
| AC-01 | 浏览器模式 WS 连接 | 在 5173 打开 AITerm，打开 DevTools Network | 看到 WS 101 握手成功，连接状态为 OPEN |
| AC-02 | 终端输出显示 | 浏览器模式打开终端，运行 `ls` | 终端有输出，不是空白 |
| AC-03 | WS 连接不影响生产打包 | 执行 `npm run build` 后在 Electron 中运行 | Electron 模式 WS 仍正常工作 |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] 浏览器控制台无 WebSocket 连接错误（不出现 `ws://localhost:5173/ws` 连接失败）
- [ ] Vite proxy 配置启用 `ws: true`
