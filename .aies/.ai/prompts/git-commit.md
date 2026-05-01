# Prompt 模板：Git 代码提交助手

## 适用场景

完成一段开发工作后，需要将代码提交到 Git 时使用。

---

## 触发语

直接告诉 AI「帮我提交代码」或「提交当前分支代码」即可。

---

## 自动收集信息（AI 并行执行）

```bash
# 1. 当前分支
git branch --show-current

# 2. 工作区状态
git status --short

# 3. 未暂存改动
git diff --stat

# 4. 已暂存改动
git diff --cached --stat

# 5. 最近 5 条 commit（了解风格）
git log --oneline -5

# 6. 远程仓库
git remote -v

# 7. 未推送的 commit
git log --oneline @{upstream}..HEAD 2>/dev/null
```

---

## 执行流程

### Step 1: 分析改动

将所有变更分为三类：

| 类别 | 处理 |
|------|------|
| ✅ 应提交 | 业务代码、文档、配置改动 |
| ⚠️ 需确认 | 临时调试代码、环境配置 → 问用户 |
| ❌ 应忽略 | `.DS_Store`、`node_modules`、`__pycache__`、`.env` → 建议加 .gitignore |

### Step 2: 智能暂存

- ❌ **永远不用** `git add .` 或 `git add -A`
- ✅ 精确指定文件：`git add file1 file2 ...`
- ⚠️ 大文件（>1MB）提醒用户确认

### Step 3: 生成 Commit Message

#### 规范格式

```
{type}({scope}): {description} [ai-assisted]

### {分类1}
- {改动1}
- {改动2}
```

**Type**：
- `feat` —— 新功能
- `fix` —— 修复 Bug
- `refactor` —— 重构
- `docs` —— 文档
- `chore` —— 构建/工具
- `test` —— 测试
- `style` —— 代码格式
- `perf` —— 性能优化

**Scope**：模块名（如 `auth`、`api`、`ui`）

**[ai-assisted]**：AI 参与生成的代码必须标注（可追溯性，维度 5）

#### 如果分支名包含 Story ID

分支 `v1.0.0/133143997/zyongzhu/ioa_client_auth` → commit 前缀：
```
feat(auth): --story=133143997, 实现 IOA 客户端鉴权 [ai-assisted]
```

### Step 4: 提交前确认

```bash
git diff --cached --stat   # 先确认暂存内容
# 等用户确认后
git commit -m "<message>"
```

### Step 5: 推送

```bash
git push                    # 已有 upstream
git push -u origin <branch> # 新分支
```

推送异常：
- 被拒绝 → 提示 `git pull --rebase`，**不要 --force**
- 认证失败 → 提示配置 SSH key

### Step 6: 输出总结

```
✅ 提交完成
📌 分支: <branch>
📝 Commit: <hash> <title>
📁 涉及 N 个文件
🔗 远程: <url>
```

---

## 安全红线（必须遵守）

```
❌ 绝不 git push --force（除非用户三次确认）
❌ 绝不 git reset --hard
❌ 绝不修改 git config
❌ 绝不 git add .（必须精确指定）
❌ 绝不跳过 pre-commit hooks（--no-verify）
❌ 绝不在用户未确认前 commit
✅ 始终用 --no-pager 或 | cat 避免交互式分页
✅ 始终检查 .gitignore 是否完善
```

---

## 特殊场景

### 场景 A：用户说「帮我提交」（模糊指令）
1. 先分析改动
2. 展示改动分类和建议的 message
3. 等用户确认后再执行

### 场景 B：有多个不相关的改动
**建议拆分为多个 commit**，按功能分组添加和提交。

### 场景 C：工作区有冲突
- **不要尝试自动解决**
- 列出冲突文件，提示用户先解决
