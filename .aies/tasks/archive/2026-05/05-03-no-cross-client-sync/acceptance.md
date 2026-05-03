# 验收与测试：跨客户端状态变更无广播同步

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 操作 | 期望结果 |
|---|------|------|--------|
| AC-01 | 新增 project 跨端同步 | 客户端 A 新增 project，5s 内观察客户端 B | 客户端 B 项目列表出现新 project，无需刷新 |
| AC-02 | 删除 project 跨端同步 | 客户端 A 删除 project，观察客户端 B | 客户端 B 该 project 消失 |
| AC-03 | 新建 terminal tab 跨端同步 | 客户端 A 新建 terminal，观察客户端 B | 客户端 B 侧边栏显示新 terminal |
| AC-04 | 关闭 editor 跨端同步 | 客户端 A 关闭 editor，观察客户端 B | 客户端 B 该 editor tab 消失 |
| AC-05 | 重命名 terminal 跨端同步 | 客户端 A 重命名 terminal，观察客户端 B | 客户端 B 该 terminal 名称更新 |
| AC-06 | 自身操作不重复触发 | 客户端 A 新增 project | 客户端 A 不因收到自己的广播而重复刷新 |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] WebSocket 广播事件有统一的 `state_changed` 类型，带 `type` 子字段区分操作
- [ ] 客户端刷新逻辑不重建 PTY 会话（只刷新 UI 状态数据）
