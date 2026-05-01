# Cross-Layer — 跨层边界检查

> **防止的问题**：层职责混乱（Handler 直接查 DB，Model 层包含业务逻辑），导致代码耦合难维护。

---

## 项目分层约定（按实际填写）

```
TODO: 在此填写本项目的分层结构，例如：

Router → Handler/API → Service → Model/Repository → DB
  ↑                                                    ↑
  入口                                              数据层

依赖方向：单向向下，禁止反向依赖
```

---

## 检查清单

写代码前，逐项确认：

- [ ] **我在哪层写代码？** 明确当前函数属于哪一层
- [ ] **我调用了哪些东西？** 列出调用的函数/对象
- [ ] **调用方向对吗？** Handler 不能直接访问 DB；Service 不能包含路由逻辑
- [ ] **数据结构有没有穿层？** DTO 应在 Handler 层转换，不能把 DB Model 直接返回给外部
- [ ] **有没有循环依赖？** A 依赖 B，B 又依赖 A → 必须抽象接口解决

---

## ❌ 典型错误

```go
// Handler 直接操作 DB
func GetAgent(c *gin.Context) {
    var agent model.Agent
    db.Where("id = ?", c.Param("id")).First(&agent)  // ❌ Handler 不该直接查 DB
    c.JSON(200, agent)  // ❌ 直接返回 DB Model，暴露内部字段
}
```

---

## ✅ 正确做法

```go
// Handler 层：参数解析 + 调用 Service + 响应封装
func GetAgent(c *gin.Context) {
    id := c.Param("id")
    agent, err := agentService.GetByID(c.Request.Context(), id)
    if err != nil {
        render.Error(c, err)
        return
    }
    c.JSON(200, dto.AgentResponse{...})  // ✅ DTO 在 Handler 转换
}

// Service 层：业务逻辑
func (s *AgentService) GetByID(ctx context.Context, id string) (*model.Agent, error) {
    return s.agentModel.GetByID(ctx, id)
}
```

---

## 常见跨层越界模式

| 越界行为 | 应该怎么做 |
|---------|-----------|
| Handler 直接访问 DB | 通过 Service 层封装 |
| Service 调用 `gin.Context` | 提取所需参数传入，不传 ctx |
| Model 层包含 HTTP 状态码 | 状态码只在 Handler 层使用 |
| Service 直接构造 HTTP 响应 | Service 返回数据，Handler 构造响应 |
| DB Model 直接序列化给前端 | 定义独立 DTO，在 Handler 层转换 |
