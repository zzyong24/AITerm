# ai-terminal — AIES Agent 操作系统

> **定位**：这不是一套编码规范，是一个 Agent 操作系统。
> `.aies/` + `.ai/` 是 Agent 的上下文体系和跨会话记忆，人只提供意图和拍板，Agent 驱动一切。

---

## Agent 的工作模式

**不要等人告诉你怎么做。根据人说的话，自己判断该做什么。**

```
人说的话
  │
  ├─ 这是一个新需求/功能/修复
  │   └─ → 执行 /aies:task 流程（意图解析 → 提议 prd+acceptance → 确认 → 实现）
  │
  ├─ 继续/上次/那个任务
  │   └─ → 执行 /aies:start 流程（读 journal 接续上下文）
  │
  ├─ 项目刚创建 / .aies 不存在
  │   └─ → 执行 /aies:bootstrap 流程（引导初始化）
  │
  ├─ 做完了 / 提交 / 收尾
  │   └─ → 执行 /aies:finish 流程（Phase 3 + Spec 回流 + 日志）
  │
  └─ 其他（问问题、聊方案、debug）
      └─ → 先读 .ai/index.md，基于项目真实上下文回答
```

---

## Agent 能力地图

| 能力 | 触发方式 | 命令 |
|------|---------|------|
| 初始化项目 | 检测到 `.aies/` 不存在，或用户说"初始化/setup" | `/aies:bootstrap` |
| 接收意图创建任务 | 用户描述新需求 | `/aies:task` |
| 开始/恢复会话 | 用户说"开始/继续" | `/aies:start` |
| 完成收尾 | 实现完毕，或用户说"完成/收尾" | `/aies:finish` |
| 查看状态 | 用户问"现在在做什么/进度" | 读 `.aies/tasks/` + journal |
| 升级模板 | 用户说"更新脚手架" | `python3 bootstrap.py --upgrade` |

---

## 提议协议（核心）

**Agent 永远是提议者，人是拍板者。**

Agent 不问"你想要什么"，而是说"我的理解是这样，你看对不对"：

```
❌ 错误模式（问卷式）：
   "请问您需要什么功能？验收标准是什么？"

✅ 正确模式（提议式）：
   "我的理解：你要做X。
    我提议的验收标准：[3条具体场景]
    不确定的地方：[1-2个问题]
    说'ok'开始，或直接告诉我哪里要改。"
```

---

## 上下文体系

Agent 读写文件的职责：

```
读：
  .aies/spec/index.md      ← 规范总导航
  .aies/spec/guides/       ← Thinking Guides（动手前检查）
  .aies/workflow.md        ← 工作流协议
  .ai/index.md             ← 项目地图（模块/接口/函数真实存在的）
  .ai/review-checklist.md  ← Code Review 清单
  .aies/tasks/{当前任务}/context.jsonl  ← 本任务需要的 spec

写：
  .aies/tasks/{slug}/prd.md          ← Agent 填写，人确认
  .aies/tasks/{slug}/acceptance.md   ← Agent 填写，人确认
  .aies/tasks/{slug}/context.jsonl   ← Agent 根据任务类型自动生成
  .aies/workspace/{dev}/journal.md   ← 会话记忆，自动追加
  .aies/spec/*.md                    ← Spec 回流时直接修改
  .ai/index.md                       ← 完成任务后更新
  .ai/changelog.md                   ← Spec 变更记录
```

---

## 三条铁律

1. **禁止编造**：任何函数、类型、接口，先读 `.ai/index.md` 确认真实存在
2. **禁止沉默跳过**：Phase 3 Spec 回流三问，必须显式回答
3. **禁止未确认提交**：`git commit/push` 需要用户明确说"提交"

---

## 规范位置

```
.aies/spec/         ← 所有编码规范（architecture/code-style/quality-gates/...）
.aies/spec/guides/  ← Thinking Guides（code-reuse/cross-layer/auth-context）
.ai/                ← 项目实例信息（index/review-checklist/glossary/...）
```

详见 `.aies/spec/index.md`。
