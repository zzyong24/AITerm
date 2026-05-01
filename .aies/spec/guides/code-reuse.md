# Code Reuse — 动手前先搜

> **防止的问题**：重复造轮子，导致同一逻辑在多处维护，行为不一致。
>
> 在写任何新函数/工具函数/模型结构前，先花 2 分钟搜索。

---

## 检查清单

在新增代码前，逐项确认：

- [ ] **搜索关键词**：用函数名/功能关键词在项目中搜索一遍
  ```bash
  grep -r "关键词" --include="*.go" .
  # 或
  grep -r "关键词" --include="*.py" .
  ```
- [ ] **检查 utils/helper 目录**：项目是否有专属工具包？（如 `pkg/util/`、`internal/utils/`、`src/utils/`）
- [ ] **检查相邻服务**：同 monorepo 内其他服务是否有类似实现，可以复用？
- [ ] **检查 AI 常见误区**：AI 生成代码时容易生成项目中不存在的函数名，**写前先读 `.ai/index.md` 确认函数/类型是否真实存在**

---

## ❌ 典型错误

```go
// 在 handler.go 里直接写了一遍 pagination 逻辑
func listAgents(c *gin.Context) {
    page := c.DefaultQuery("page", "1")
    pageSize := c.DefaultQuery("page_size", "20")
    // ... 手写分页
}
```

项目里已经有 `pkg/util/pagination.go` 的 `ParsePagination(c)` 函数。

---

## ✅ 正确做法

```go
// 先搜 pagination，找到 pkg/util/pagination.go
import "project/pkg/util"

func listAgents(c *gin.Context) {
    page, pageSize := util.ParsePagination(c)
    // ...
}
```

---

## 规则

**如果找到了类似实现**：
1. 评估是否可以直接复用
2. 如需扩展，修改原函数（加参数/接口抽象），不要新建副本
3. 如完全不同，在代码注释里写明"与 X 的区别是..."

**如果没找到**：
1. 新建时放在合适的 utils/pkg 目录，不要塞进 handler/service
2. 写完后更新 `.ai/index.md` 中的工具函数列表
