# /aies:task

接收用户的意图描述，自动完成任务创建、prd 填写、acceptance 填写，提议给用户确认后进入实现。

**人只描述意图，Agent 做所有文件工作。**

## 触发条件

用户描述任何新需求、新功能、修复、重构，且尚未有对应任务目录。

关键词：做、实现、加、修、改、重构、支持、需要、想要、帮我……

## 执行流程

### Step 1：意图解析

读取以下文件作为上下文：
- `.ai/index.md` — 确认相关模块/函数是否真实存在
- `.aies/spec/architecture.md` — 理解分层约束
- `.aies/spec/guides/index.md` — 判断需要哪些 Thinking Guide
- `.aies/tasks/` — 检查是否已有相关任务

基于用户描述，在脑内形成：
```
任务类型：[新功能 / Bug修复 / 重构 / 性能优化 / 其他]
涉及模块：[从 .ai/index.md 找到的真实模块名]
技术路径：[大致方向]
边界条件：[可能涉及的约束，参考 spec/guides/]
不确定点：[Agent 不确定的地方，需要向用户澄清]
```

### Step 2：创建任务结构

```bash
python3 .aies/scripts/task.py create "{从意图提取的标题}" --slug {kebab-case-slug}
```

### Step 3：Agent 填写 prd.md

基于意图解析，**直接写入** `prd.md`，不是留 TODO：

```markdown
# {任务标题}

## 需求背景
{Agent 对用户意图的理解，1-3句话}

## 核心目标
{具体要达成什么，可验证的}

## 技术方案（草稿）
{大致技术路径，涉及哪些模块}

## 影响范围
- 修改文件：{从 .ai/index.md 推断}
- 新增文件：{如需要}

## 🤔 Agent 的不确定点
{列出 1-3 个 Agent 不确定的地方，需要用户澄清}
```

### Step 4：Agent 填写 acceptance.md

**基于意图主动推导验收场景**，覆盖 Happy Path + 边界 + 错误路径：

参考对应 Thinking Guide 推导边界：
- 涉及鉴权 → 检查 `spec/guides/auth-context.md` 的常见空洞
- 跨层调用 → 检查 `spec/guides/cross-layer.md` 的越界模式
- 新增函数 → 检查 `spec/guides/code-reuse.md` 的重复问题

```markdown
# 验收标准：{任务标题}

## P0 验收场景（必须全部通过）

| # | 场景描述 | 输入条件 | 期望结果 |
|---|---------|---------|---------|
| AC-01 | Happy Path：{主流程} | {正常输入} | {正确输出} |
| AC-02 | 边界：{Agent 推断的关键边界} | {边界输入} | {期望行为} |
| AC-03 | 错误：{最可能出错的场景} | {异常输入} | {优雅降级/报错} |

## P1 验收场景（尽量通过）
...
```

### Step 5：生成 context.jsonl

根据任务类型，自动判断 implement 和 check 阶段需要的 spec：

```jsonl
{"phase": "implement", "spec": "architecture.md", "reason": "确认分层约束"}
{"phase": "implement", "spec": "code-style.md", "reason": "命名和格式"}
// 如涉及鉴权：
{"phase": "implement", "spec": "guides/auth-context.md", "reason": "鉴权透传检查"}
// 如跨层：
{"phase": "implement", "spec": "guides/cross-layer.md", "reason": "层边界检查"}
{"phase": "check", "spec": "quality-gates.md", "reason": "质量门自检"}
{"phase": "check", "spec": "error-handling.md", "reason": "错误处理规范"}
```

### Step 6：提议展示（等待用户确认）

输出以下格式，**一次性展示全部**，不要分多轮问：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 我对这个任务的理解

**要做的事**：{一句话}

**涉及模块**：{列表}

**我提议的验收标准**（{N}条）：
  ✅ AC-01：{场景} → {期望结果}
  ✅ AC-02：{场景} → {期望结果}
  ✅ AC-03：{场景} → {期望结果}

**我的不确定点**：
  ❓ {问题1}
  ❓ {问题2}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
说 **"ok"** 我直接开始实现。
或者告诉我哪里需要调整（比如"AC-02 改成要返回 403"）。
```

### Step 7：处理确认

**用户说 "ok" / "确认" / "开始"**：
→ 直接进入实现（不再重复输出清单）
→ 读取 context.jsonl 加载对应 spec
→ 按 Phase 1 → Phase 2 → Phase 3 执行

**用户提出修改**（如"AC-02 要改成..."）：
→ Agent 直接更新 acceptance.md 对应行
→ 重新展示变更点，再次确认
→ 用户说 ok 后开始

**用户提供了不确定点的答案**：
→ 更新 prd.md 中的 "🤔 不确定点" 章节
→ 将答案注入到 context.jsonl 或直接体现在实现中

### Step 8：实现完成后

自动触发 `/aies:finish` 流程。
