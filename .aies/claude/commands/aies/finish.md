# /aies:finish

实现完成后的完整收尾流程。Agent 自动执行，人只需确认 Spec 回流决策。

## 触发条件

- 实现完成，或用户说"完成/收尾/done/提交"
- 每次 `/aies:task` 的 Step 8 自动调用

## 执行流程

### Step 1：质量自检

```bash
# 获取本次变更
git diff --name-only
git diff
```

对照 `.aies/tasks/{slug}/acceptance.md` 的 P0 场景，逐条确认是否实现。

对照 `.ai/review-checklist.md` 9 大维度自检。

### Step 2：输出完成清单

```
✅ Phase 3 完成清单
━━━━━━━━━━━━━━━━━━

**变更文件**（{N}个）：
  - {file}: {一句话说改了什么}

**验收场景**：
  - [✅/❌] AC-01：{场景}
  - [✅/❌] AC-02：{场景}
  - [✅/❌] AC-03：{场景}

**质量自检**：
  - [✅] 架构合规（分层未越界）
  - [✅] 错误处理（统一错误码）
  - [✅] 安全检查（无越权/注入风险）
  - [✅] 日志规范（关键操作有日志）
  - [✅] 编译/类型检查通过
```

### Step 3：更新项目地图

检查 `.ai/index.md` — 如果本次任务新增了文件/接口/函数，**直接更新**，不等用户要求。

### Step 4：Spec 回流（强制，不可跳过）

回答三个问题并展示给用户：

```
⭐ Spec 回流分析
━━━━━━━━━━━━━━
Q1 本次有没有"应该统一规范"的地方？
   → {Agent 的分析}

Q2 有没有踩坑，下次需要提前规避？
   → {Agent 的分析}

Q3 spec/guides/ 需要新增场景吗？
   → {Agent 的分析}
```

**如果有需要沉淀的内容**：

Agent 直接修改对应 spec 文件，然后展示 diff 给用户：

```
我打算在 {spec/xxx.md} 追加以下内容：
---
{新增内容}
---
确认吗？（说"ok"写入，或告诉我要改什么）
```

**如果无新约定**：明确输出 `Spec 回流：无新约定`。

### Step 5：生成会话日志

**直接执行**，不让用户手动：

```bash
python3 .aies/scripts/session.py add \
    --title "{任务标题}" \
    --commit "$(git rev-parse --short HEAD 2>/dev/null || echo 'no-commit')" \
    --summary "{变更摘要：做了什么，改了哪些文件，关键决策}"
```

### Step 6：归档任务

```bash
python3 .aies/scripts/task.py finish {slug}
```

### Step 7：输出 commit 建议

```
📝 建议的 commit message：
   {type}({scope}): {描述} [ai-assisted]

   说"提交"我来执行，或自己运行：
   git add -p && git commit -m "..."
```

## 注意

- Spec 修改需要用户确认，其他步骤（日志、任务归档）Agent 自动执行
- 如果测试/编译失败，停在 Step 1 并报告，不继续
