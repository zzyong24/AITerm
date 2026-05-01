# /aies:start

初始化 AIES 会话。（`/start` 是本命令的短别名）

## 执行步骤

1. 读取 `.aies/workflow.md` 理解工作流
2. 运行 `python3 .aies/scripts/session.py get-context` 获取当前上下文
3. 读取 `.aies/spec/index.md` 查看规范导航
4. 读取 `.ai/index.md` 查看项目地图
5. 如存在 `.aies/spec/guides/index.md`，读取并展示可用 Thinking Guides
6. 如有活跃任务，检查任务目录下是否有 `context.jsonl`，提示用户确认后可加载
7. 输出初始化报告：

```
🌱 AIES Session 已初始化
━━━━━━━━━━━━━━━━━━━━━━━
• 开发者:          {从 .aies/.developer 读取，未初始化则提示运行 init-developer.py}
• 活跃任务:        {列表 或 "无活跃任务"}
• 最近提交:        {git_hash} — {commit_msg}
• 已加载规范:      spec/index.md + review-checklist.md
• Thinking Guides: {code-reuse / cross-layer / auth-context}

等待用户第一条指令。
```

8. 如有活跃任务，询问是否继续
