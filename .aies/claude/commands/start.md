# /start  （/aies:start 的别名）

会话入口。根据项目状态和用户语境，路由到正确的模式。

## 执行逻辑

### 检测项目状态

```bash
ls .aies/workflow.md 2>/dev/null || echo "UNINITIALIZED"
cat .aies/.developer 2>/dev/null
python3 .aies/scripts/session.py get-context 2>/dev/null
```

### 路由决策

**情况 A：未初始化（.aies/ 不存在）**

```
⚠️ 项目尚未初始化 AIES。

我检测到：
- 语言栈：{检测结果}
- 缺少：AIES 上下文体系（.aies/ + .ai/）

输入 /aies:bootstrap 开始初始化（约 5 分钟，全程我来引导）。
或者直接告诉我你想做什么，我先帮你处理后台再干活。
```

**情况 B：已初始化，有活跃任务**

```
🌱 会话已就绪

开发者：{name}
活跃任务（{N}个）：
  - [{status}] {slug}: {title}

最近会话：{最后一条 journal 摘要}

要继续哪个任务？或者直接描述你要做的事。
```

**情况 C：已初始化，无活跃任务**

```
🌱 会话已就绪

开发者：{name}
暂无活跃任务。

直接告诉我你要做什么。
```

**情况 D：无开发者身份**

先问：`你叫什么名字？（用于会话日志）`
执行：`python3 .aies/scripts/init-developer.py {name}`
然后按 B/C 继续。

## 不要做的事

- ❌ 不要输出大段"系统已就绪"样板文字
- ❌ 不要重复列出所有 slash 命令
- ✅ 简洁，直接问用户下一步
