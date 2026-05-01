# /aies:autopilot

自驱执行入口。定时触发后，Agent 自主找到下一个任务，从上次中断点继续，直到完成或遇到阻塞。

**人不需要在场。遇到阻塞才通知人。**

## 触发方式

```bash
# 通过 /loop 定时触发（推荐）
/loop 30m /aies:autopilot

# 手动触发（测试用）
/aies:autopilot
```

## 完整执行协议

### Step 1：找到下一个任务

```bash
python3 .aies/scripts/next-task.py
```

解析输出的 JSON：
- `found: false` → 输出 "🎉 所有自驱任务已完成"，停止
- `found: true` → 继续 Step 2

### Step 2：加载任务上下文

读取以下文件（**这是上下文清空后的恢复入口**）：

```
{task_dir}/checkpoint.md     ← 上次执行到哪了（最重要）
{task_dir}/prd.md            ← 任务需求
{task_dir}/acceptance.md     ← 验收标准
{task_dir}/context.jsonl     ← 需要加载哪些 spec
.aies/spec/{spec}            ← 按 context.jsonl 精准加载
.ai/index.md                 ← 项目地图（禁止编造）
```

从 checkpoint.md 的 `**下一步**` 字段确定从哪个步骤恢复。

### Step 3：判断任务阶段

根据 checkpoint 的 `**阶段**` 字段路由：

| checkpoint 阶段 | 执行动作 |
|----------------|---------|
| `waiting` / `confirmed`（首次启动）| → Step 4A：填写 acceptance.md，进入 implement |
| `in_progress: implement` | → Step 4B：继续实现 |
| `in_progress: implement-done` | → Step 4C：运行测试 |
| `in_progress: test-pass` | → Step 4D：运行 E2E |
| `in_progress: e2e-pass` | → Step 4E：Spec 回流 + 收尾 |
| `BLOCKED` | → 输出阻塞信息，停止，等人处理 |

### Step 4A：首次启动（填 acceptance + 进入实现）

1. 基于 prd.md 内容，**补充填写** acceptance.md 的具体验收场景（替换 TODO）
2. 更新 checkpoint：
   ```bash
   python3 .aies/scripts/task.py start {slug}
   python3 .aies/scripts/task.py checkpoint {slug} \
     --step "acceptance-filled" \
     --summary "基于 prd 填写了 {N} 条 P0 验收场景" \
     --next "implement: {下一步实现内容}" \
     --phase "in_progress: implement"
   ```
3. 进入 Step 4B

### Step 4B：实现代码

1. 按 context.jsonl 加载 spec（不全量读）
2. 按 spec/guides/ 中相关 Thinking Guide 检查边界
3. 读 `.ai/index.md` 确认函数/类型真实存在
4. **实现代码**
5. 运行构建/lint 检查
6. 每完成一个逻辑单元，更新 checkpoint：
   ```bash
   python3 .aies/scripts/task.py checkpoint {slug} \
     --step "implement: {具体实现的内容}" \
     --summary "{做了什么，改了哪些文件}" \
     --next "{下一步：继续实现X 或 写测试}" \
     --phase "in_progress: implement"
   ```
7. 如遇到阻塞（依赖未完成/需要人判断），执行 Step 4F

### Step 4C：运行单元测试

```bash
pytest tests/unit/ -v  # 或项目指定的测试命令
```

**全通过** → 更新 checkpoint `--phase "in_progress: test-pass"` → Step 4D

**失败** → 先尝试自修复（最多 2 轮）→ 仍失败 → Step 4F（block）

### Step 4D：运行 E2E 测试

按 acceptance.md 的验收命令执行。

**全通过** → 更新 checkpoint `--phase "in_progress: e2e-pass"` → Step 4E

**失败** → 先尝试自修复 → 仍失败 → Step 4F（block）

### Step 4E：完成收尾

1. Spec 回流：
   - Q1: 有统一规范的地方？
   - Q2: 有踩坑要记录？
   - Q3: guides/ 需要新增？
   - **有则直接修改 spec，并在 .ai/changelog.md 追加**（自驱模式不需要人确认）
2. 更新 `.ai/index.md`（如有新增文件/接口）
3. 追加会话日志：
   ```bash
   python3 .aies/scripts/session.py add \
     --title "{任务标题}" \
     --summary "{实现摘要}"
   ```
4. 标记任务完成：
   ```bash
   python3 .aies/scripts/task.py finish {slug}
   ```
5. 输出 commit 建议（**不执行 git commit**，等人确认）
6. **回到 Step 1**，继续找下一个任务

### Step 4F：遇到阻塞

当遇到以下情况时，标记 blocked 并停止：

- 需要人的判断/决策
- 外部依赖未就绪（其他任务未完成、API 不可用）
- 测试连续失败超过 2 轮无法自修复
- 代码改动超出 prd/acceptance 范围
- 需要人工确认才能继续的设计决策

```bash
python3 .aies/scripts/task.py block {slug} \
  --reason "{具体原因，足够清晰让人知道怎么介入}"
```

输出给人：
```
🚫 任务 [{title}] 遇到阻塞，需要人工介入

原因：{reason}

介入后运行：
  python3 .aies/scripts/task.py unblock {slug}
然后重新触发 /aies:autopilot 继续执行。
```

**停止本次 autopilot 执行。**

---

## 自驱 vs 人工 模式对比

| 步骤 | 自驱模式（autopilot）| 人工模式（/aies:task）|
|------|---------------------|----------------------|
| acceptance.md | Agent 自动填写，不等人确认 | Agent 填写 → **等人确认** |
| Spec 回流 | Agent 直接修改，不等人确认 | Agent 展示 → **等人确认** |
| git commit | 建议 message，**不执行** | 建议 message，**不执行** |
| 遇阻塞 | 标记 blocked，停止，等人 | 展示给人，等人指示 |

---

## checkpoint.md 格式（Agent 的工作记忆）

```markdown
# Checkpoint: {任务标题}

## 当前状态

- **阶段**：in_progress: implement
- **已完成步骤**：acceptance-filled, implement: core-logic
- **下一步**：写单元测试 tests/unit/test_feature_x.py
- **最后更新**：2026-04-30 15:30:00

## 执行历史

### 2026-04-30 15:00:00 — acceptance-filled
基于 prd.md 填写了 3 条 P0 验收场景

### 2026-04-30 15:30:00 — implement: core-logic
实现了 `feature_x()` 主逻辑，修改文件: src/feature_x.py

## 阻塞记录

（无）
```

**关键**：每次 autopilot 触发后，Agent 读 checkpoint.md 的 `**下一步**` 字段恢复执行位置，这是上下文清空后唯一可靠的恢复入口。
