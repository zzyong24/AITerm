# Thinking Guides 索引

> 这里不是编码规范，而是**动手前的思维检查清单**。
>
> 大多数 bug 来自"没想到"，不是"不会写"。
> 在遇到对应场景时，花 5 分钟读一下对应 guide，节省 3 小时调试。

---

## 指南列表

| Guide | 适用场景 | 核心问题 |
|-------|---------|---------|
| [code-reuse.md](./code-reuse.md) | 新增函数/类/模块前 | 项目里是否已有类似实现？ |
| [cross-layer.md](./cross-layer.md) | 功能跨多个层/服务 | 数据流是否越界？依赖方向是否正确？ |
| [auth-context.md](./auth-context.md) | 涉及用户身份/权限的代码 | 鉴权上下文有没有完整透传？ |

---

## 何时使用

```
新增一个函数/工具函数   → 先读 code-reuse.md
跨 Router/Service/Model → 先读 cross-layer.md
写 MCP 工具/API Handler → 先读 auth-context.md
多个 service 交互       → cross-layer + auth-context 都读
```

---

## 如何扩展

发现新的高频踩坑模式 → 在本目录新建 `{topic}.md`，并在上表追加一行。

格式要求：
1. 一句话说清楚这个 guide 防止什么问题
2. 给出 3-5 个检查问题（Checklist）
3. 给出一个反面 ❌ 和正面 ✅ 例子
4. 不超过 80 行
