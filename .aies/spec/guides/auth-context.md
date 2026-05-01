# Auth Context — 鉴权上下文透传检查

> **防止的问题**：用户身份/权限在多层调用链中丢失，导致越权访问或鉴权空洞。
>
> 特别适用于：MCP 工具、代理调用下游服务、多租户数据隔离场景。

---

## 鉴权上下文的三个层次

```
1. 身份层：用户是谁？（uid / rtx / session token）
2. 权限层：用户能做什么？（role / scope / 资源 ACL）
3. 隔离层：用户只能看自己的数据？（workspace_id / tenant_id）
```

每一层都必须在整个调用链上完整传递。

---

## 检查清单

写涉及身份/权限的代码前，逐项确认：

- [ ] **入口提取**：在哪里提取鉴权信息？（HTTP Header / JWT / Session）明确写在入口处
- [ ] **注入上下文**：提取后是否注入到 `ctx`（Go）或 `request.state`（Python）？
  - Go: `ctx = context.WithValue(ctx, constant.LoginUID, uid)`
  - Python: `request.state.user_id = uid`
- [ ] **服务调用透传**：调用下游服务时，是否携带了鉴权 Header？
  - MCP 场景：检查是否注入了 `X-Growth-UID` / `X-Growth-RTX`
- [ ] **数据查询过滤**：查询 DB 时是否加了 workspace/tenant 过滤？
- [ ] **跨服务边界**：每次跨服务调用都要重新确认：对方怎么鉴权？我有没有传？
- [ ] **AI 生成代码专项检查**：AI 容易遗漏鉴权传递，每次 AI 生成涉及服务调用的代码后必须手动审查此项

---

## ❌ 典型错误

```python
# MCP tool 被调用时，忘记从 context 取 user_id
@mcp_tool
def get_ad_data(account_id: str) -> dict:
    # ❌ 直接查，没有鉴权过滤
    return db.query(f"SELECT * FROM ad_data WHERE account_id = {account_id}")
```

---

## ✅ 正确做法

```python
# 入口：从 Header 提取，注入 state
async def mcp_auth_middleware(request: Request, call_next):
    uid = request.headers.get("X-Growth-UID")
    rtx = request.headers.get("X-Growth-RTX")
    if not uid:
        return Response(status_code=401)
    request.state.uid = uid
    request.state.rtx = rtx
    return await call_next(request)

# Tool：从 state 取，做权限过滤
@mcp_tool
def get_ad_data(request: Request, account_id: str) -> dict:
    uid = request.state.uid
    # ✅ 先验证 uid 是否有权限访问该 account_id
    permitted_ids = get_permitted_account_ids(uid)
    if account_id not in permitted_ids:
        raise PermissionError(f"uid={uid} 无权访问 account_id={account_id}")
    return db.query("SELECT * FROM ad_data WHERE account_id = ?", account_id)
```

---

## 标准鉴权 Header（MCP 接入规范）

| Header | 含义 | 是否必须 |
|--------|------|---------|
| `X-Growth-UID` | 用户 uid（int64） | ✅ 必须 |
| `X-Growth-RTX` | 用户 RTX | ✅ 必须 |
| `X-Growth-Workspace-ID` | 调用方 workspace | 可选 |

---

## 常见鉴权空洞模式

| 空洞类型 | 描述 | 修复方式 |
|---------|------|---------|
| 身份丢失 | MCP 调用时没带 Header | middleware 注入，tool 层从 state 取 |
| 越权查询 | 只验证登录，不验证资源归属 | 查询时加 `AND owner_uid = ?` 过滤 |
| 租户混用 | 多 workspace 共享同一查询 | 查询条件加 `workspace_id = ?` |
| 服务间不鉴权 | 内网服务认为不需要鉴权 | 内网也要校验 UID，防止内部越权 |
| AI 生成遗漏 | AI 写的代码没有鉴权步骤 | Code Review 时专项检查此项 |
