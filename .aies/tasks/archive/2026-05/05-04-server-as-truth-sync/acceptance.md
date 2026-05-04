# 验收标准：Server-as-Single-Truth 跨端状态同步重构

**任务**: 05-04-server-as-truth-sync  
**日期**: 2026-05-04

---

## P0 — 必须全部通过（发布门槛）

### AC-01 — 多窗口实时同步（新建）
- 场景：两个浏览器窗口同时打开 AITerm，在窗口 A 新建终端
- 期望：窗口 B 在 500ms 内自动出现对应 tab，不重复，不遗漏

### AC-02 — 多窗口实时同步（关闭）
- 场景：在窗口 A 关闭某终端
- 期望：窗口 B 对应 tab 消失，activeItemId 自动切换到相邻 tab

### AC-03 — 重命名同步
- 场景：在任意窗口对终端 tab 双击重命名
- 期望：两端 tab 标签在 500ms 内同步更新

### AC-04 — 刷新不倍增
- 场景：打开 N 个终端后刷新页面
- 期望：恢复后终端数量 = 刷新前数量（不出现 N*2 情况）

### AC-05 — 关闭非激活 tab 不跳变
- 场景：当前显示 tab C，关闭 tab A（非激活）
- 期望：tab C 保持激活，不发生跳变

### AC-06 — 单元测试全通过
- 命令：`npx vitest run`
- 期望：27/27 tests passed

### AC-07 — E2E 测试全通过
- 命令：`npx playwright test`
- 期望：9 passed, 1 skipped（Electron 部署测试，需 Electron 运行时才执行）

---

## P1 — 应该通过（但不阻塞发布）

### AC-08 — 乐观 UI 响应
- 场景：点击关闭终端按钮
- 期望：tab 立即消失（不等待服务端响应），无闪烁

### AC-09 — uiPrefs 偏好恢复
- 场景：用户选中 tab S2，随后服务端广播 sessions_snapshot（如 rename 触发）
- 期望：snapshot replace 后 S2 仍为 activeItemId（偏好不丢失）

### AC-10 — 无 reconcile 残余代码
- 代码审查：`src/store/AppBusiness.ts` 中不存在 `syncRemoteSessions` / `debouncedSyncRemoteSessions` 字样

---

## 排除范围

- Electron IPC 模式下的 sessions_snapshot（IPC 模式不走 WebSocket，stub 空实现即可）
- `electron-web-server.spec.ts` 在无 Electron 时允许 skip（非 CI 环境无法验证）
