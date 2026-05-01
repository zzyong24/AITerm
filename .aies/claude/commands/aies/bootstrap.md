# /aies:bootstrap

初始化当前项目的 AIES 上下文体系。Agent 全程驱动，人只回答几个问题。

## 触发条件

- 检测到 `.aies/` 目录不存在
- 用户说"初始化"、"setup"、"搭脚手架"、"配置 AIES"

## 执行流程

### Step 1：检测项目现状

```bash
# 检测语言栈
ls *.go go.mod 2>/dev/null && echo "go"
ls *.py pyproject.toml requirements.txt 2>/dev/null && echo "python"
ls package.json 2>/dev/null && echo "node"
ls *.rs Cargo.toml 2>/dev/null && echo "rust"

# 检测已有文件
ls -la .ai/ .aies/ .claude/ .cursor/ 2>/dev/null
ls CLAUDE.md AGENTS.md .cursorrules 2>/dev/null
```

基于检测结果，**直接告诉用户检测到了什么**，不要问用户"你用什么语言"：

```
我检测到：
- 语言栈：Go（找到 go.mod）
- 已有：CLAUDE.md（会保留）
- 缺少：.aies/ 整套结构

我将初始化 AIES，需要你回答 3 个问题：
```

### Step 2：三问收集意图

用**一次性**提问（不要一问一答来回）：

```
请回答以下 3 个问题（直接在下方填写）：

1. 项目名称：______
2. 这个项目的核心分层是什么？
   （例如：Router→Service→Model / Controller→UseCase→Repository / 其他）
   ______
3. 你用哪些 AI 平台？（选填，默认全部）
   [ ] Claude Code  [ ] Cursor  [ ] CodeBuddy  [ ] 全部
```

### Step 3：运行 bootstrap

根据用户回答，**直接执行**：

```bash
python3 {SCAFFOLD_DIR}/bootstrap.py \
  --target . \
  --project-name "{项目名}" \
  --platforms {claude,cursor,codebuddy...} \
  --mode merge \
  --developer {从 git config 读取 or 询问}
```

> `SCAFFOLD_DIR` = bootstrap.py 所在目录。Agent 需要先找到它：
> 检查顺序：`../ai-engineering-scaffold/` → `~/ai-engineering-scaffold/` → `$AIES_HOME`

### Step 4：引导填写 .ai/index.md（关键）

这是整个 AIES 的基础。**Agent 主动提问，用户回答，Agent 写入文件**：

```
现在我来帮你建立项目地图。请回答以下问题：

1. 项目的核心模块有哪些？（列出名称和职责，一行一个）
   例如：
   - agent-api：处理 HTTP 请求，路由分发
   - agent-service：业务逻辑
   - agent-model：数据库操作

2. 最重要的 3-5 个文件路径是什么？
   （就是你最常改的，或者最核心的）

3. 对外暴露的主要 API 路径有哪些？（可以只写关键几个）
```

用户回答后，Agent 生成并写入 `.ai/index.md`（按项目真实结构，不写 TODO）。

### Step 5：引导填写 architecture.md

```
最后一步。你的分层架构约束是：

"{用户在 Step 2 说的分层}"

我将这样写进 architecture.md：
---
[Agent 根据用户描述生成具体约束，包含禁止事项]
---

有需要调整的吗？没有的话我直接写入。
```

用户确认后写入 `.aies/spec/architecture.md`。

### Step 6：完成报告

```
✅ AIES 初始化完成！

已生成：
  .aies/spec/        规范体系（architecture/code-style/quality-gates/...）
  .aies/spec/guides/ Thinking Guides（动手前检查清单）
  .aies/tasks/       任务管理目录
  .aies/workspace/   会话记忆目录
  .ai/index.md       项目地图（已填写）
  CLAUDE.md          Agent 操作系统入口
  .claude/commands/  所有 Agent 能力命令

现在你可以直接描述你要做的第一件事，我来接管。
```

## 注意

- `.ai/index.md` 必须填写真实内容，不能留 TODO
- 如果项目已有 `.ai/index.md`，读取并展示给用户，询问是否要更新
- bootstrap.py 找不到时，提示用户：`git clone https://github.com/your-org/ai-engineering-scaffold ~/ai-engineering-scaffold`
