# 验收标准

## 场景 1：npm run dev（standalone server）

- [ ] 终端显示正常
- [ ] 项目列表加载正常
- [ ] WebSocket 通信正常

## 场景 2：Electron 桌面端（embedded server port 5003）

- [ ] 所有 API 路由可访问
- [ ] WebSocket 事件正常转发
- [ ] 静态文件服务正常

## 场景 3：跨端数据一致性

- [ ] SQLite 数据在两个服务端共享
- [ ] 两个客户端看到的数据一致