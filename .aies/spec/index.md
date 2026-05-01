# ai-terminal 规范索引

> 所有 AI 开发任务**必须**在写代码前先阅读相关 Spec 文件。
>
> 本文件是规范导航，按任务类型选择性读取，遵循「最小充分上下文」原则。

---

## 项目概览

| 项 | 值 |
|----|-----|
| 技术栈 | TODO: 填写语言/框架版本 |
| 架构模式 | TODO: 填写分层模式 |
| 最后更新 | 2026-05-01 |

---

## Spec 清单

| Spec | 适用场景 | 必读时机 |
|------|---------|---------|
| [architecture.md](./architecture.md) | 架构约束、分层职责 | **每次写代码前** |
| [code-style.md](./code-style.md) | 命名、注释、格式 | **每次写代码前** |
| [quality-gates.md](./quality-gates.md) | 禁止模式、必须模式、自检清单 | **每次写代码前** |
| [testing.md](./testing.md) | 单元测试、E2E、acceptance.md 规范 | **每次新增任务时、implement 前** |
| [error-handling.md](./error-handling.md) | 错误处理、错误码规范 | 涉及错误处理时 |
| [logging.md](./logging.md) | 日志级别、格式、敏感字段 | 涉及日志时 |

---

## Thinking Guides（动手前思维检查）

> 不是规范，是**防踩坑的思维框架**。遇到对应场景时花 5 分钟读一遍。

| Guide | 适用场景 |
|-------|---------|
| [guides/code-reuse.md](./guides/code-reuse.md) | 新增函数/工具函数前，先搜索是否已有类似实现 |
| [guides/cross-layer.md](./guides/cross-layer.md) | 功能跨多个架构层时，检查依赖方向和数据边界 |
| [guides/auth-context.md](./guides/auth-context.md) | 涉及用户身份/权限/MCP 调用时，检查鉴权透传 |

---

## 开发前必读清单

```bash
# 每次任务开始前按顺序读取：
cat .aies/spec/index.md              # 本文件
cat .aies/spec/architecture.md       # 架构约束
cat .aies/spec/code-style.md         # 代码风格
cat .aies/spec/quality-gates.md      # 质量门
cat .aies/spec/testing.md            # 测试规范（新增任务时必读）

# 按任务类型额外读取：
# 涉及错误处理 → error-handling.md
# 涉及日志     → logging.md
```

---

## 任务启动检查清单

```
📋 任务启动清单
━━━━━━━━━━━━━━
• 任务类型：[新增 / 修改 / 修复 / 重构 / 其他]
• 需读取的参考文件：[按 .ai/context-guide.md 列出]
• 涉及的规范要点：[从本目录下各 Spec 列出]
• 预计变更文件：[列出]
• 索引需更新：[是 / 否]
```

---

## 任务完成检查清单

```
✅ 任务完成清单
━━━━━━━━━━━━━━
1. 质量自检（逐项打勾）：
   - [ ] 架构合规（分层、依赖方向）
   - [ ] 代码风格（命名、注释、格式）
   - [ ] 错误处理（分类正确、使用统一错误码）
   - [ ] 安全检查（参数化、输入校验、无硬编码）
   - [ ] 日志规范（关键操作有日志、无敏感字段）
   - [ ] 编译/类型检查通过
2. 测试验收（参照 acceptance.md）：
   - [ ] 单元测试全部通过
   - [ ] E2E Happy Path 通过
   - [ ] acceptance.md 中所有 P0 验收场景打勾
3. 索引更新：[已更新 .ai/index.md / 无需更新]
4. 建议 commit message：`type(scope): 描述 [ai-assisted]`
5. ⭐ Spec 回流（强制，不可跳过）：
   Q1: 本次有没有"应该统一规范"的地方？[有/无]
   Q2: 有没有踩坑，下次需要提前规避？[有/无]
   Q3: spec/guides/ 是否需要新增场景？[有/无]
   → 有则直接修改 spec，并在 .ai/changelog.md 追加一行
   → 无则写"Spec 回流：无新约定"，不能沉默跳过
```

---

## 规范维护规则

1. **发现新约定 → 24 小时内进入 Spec**
2. **修改 Spec 必须在 `.ai/changelog.md` 记录**
3. **Spec 使用「强制」/「建议」标签清晰区分**
4. **示例代码使用 ✅/❌ 对比呈现**
