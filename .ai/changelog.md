# Spec Changelog

---

## 2026-05-04 — Server-as-SSOT 重构（05-04-server-as-truth-sync）

### testing.md — 新增三条规范

1. **Vitest 环境必须设为 `node`**：`html-encoding-sniffer` ESM 问题，jsdom 下报错
2. **Playwright 条件跳过模式**：`request.newContext()` 探针 + `test.skip(true, reason)` + `return`
3. **Native 模块版本匹配**：Node.js 版本变更后必须 `npm rebuild better-sqlite3`

### guides/cross-layer.md — 重写为 AITerm TypeScript 版

- 替换通用 Go 模板为 AITerm 实际分层架构（Vue → AppBusiness → API → PtyService）
- 新增 **Server-as-SSOT 单向数据流** 完整规范（必读区域）
- 提供 TypeScript 典型错误 + 正确做法示例

### .ai/index.md — 首次创建

- 记录 AppBusiness 所有公开方法、状态属性、AppEvents
- 记录 PtyService WebSocket 事件（sessions_snapshot）
- 记录 API 层函数命名规范
- 记录测试覆盖状态（27/27 unit + 8 e2e + 1 skip）
