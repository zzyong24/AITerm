# 错误处理规范

> 统一的错误处理方式，让 AI 和人都能正确传递/转换错误。

---

## 核心原则

1. **错误不能被吞掉** —— 每个错误要么处理，要么传递
2. **错误要有上下文** —— 包含足够信息排查
3. **错误要分类** —— 区分业务错误和系统错误
4. **错误要统一** —— 使用项目统一的错误码/错误类型

---

## 错误分类

| 类型 | HTTP 状态 | 说明 | 示例 |
|------|----------|------|------|
| 参数错误 | 400 | 用户输入不合法 | 缺必填字段、格式错误 |
| 未授权 | 401 | 未登录或 token 失效 | 无 token、token 过期 |
| 无权限 | 403 | 已登录但无权限 | 访问他人资源 |
| 资源不存在 | 404 | 查询目标不存在 | 用户/订单/文件不存在 |
| 冲突 | 409 | 资源状态冲突 | 重名、状态不允许 |
| 限流 | 429 | 请求过于频繁 | QPS 超限 |
| 服务器错误 | 500 | 内部错误 | DB 连接失败、代码 bug |

---

## 错误码规范

TODO: 按项目约定填写。通用模板：

### 分段错误码

```
1xxxx — 通用错误
2xxxx — 业务错误
  20xxx — 模块 A
  21xxx — 模块 B
  ...
3xxxx — 系统错误
```

### 错误结构

```
code:        统一错误码（int）
message:     用户可读信息（i18n 化后的消息）
http_status: 映射的 HTTP 状态码
details:     详细信息（可选，仅调试）
```

---

## 必须模式

### ✅ 必须 1：错误立即记日志

```
if err != nil {
    logger.Error(ctx, "xxx operation failed",
        zap.String("resource_id", id),
        zap.Error(err),
    )
    return errno.ErrXxx
}
```

### ✅ 必须 2：错误信息不暴露内部细节

```
// ❌ 错误：把内部 SQL / 路径暴露给用户
return fmt.Errorf("SELECT * FROM users WHERE id=%d failed: %v", id, err)

// ✅ 正确：对用户友好的错误码 + 日志记录详细信息
logger.Error(ctx, "query user failed", zap.Int64("user_id", id), zap.Error(err))
return errno.ErrUserQueryFailed
```

### ✅ 必须 3：错误使用项目统一错误类型

不要用原生 `errors.New` 或 `fmt.Errorf` 返回业务错误：

```
// ❌ 错误
return fmt.Errorf("user not found")

// ✅ 正确
return errno.ErrUserNotFound
```

### ✅ 必须 4：错误包装保留原始信息

```
// 跨层时包装，保留原错误便于排查
return errno.ErrXxx.WrapCause(err)
```

---

## 禁止模式

### ❌ 禁止 1：静默吞错误

```
_ = someFunc()   // 除非明确知道忽略安全
```

### ❌ 禁止 2：panic 代替 error

除非是不可恢复的初始化错误，不得 panic。

### ❌ 禁止 3：一个函数内存在多种错误风格

同一层的所有函数应使用相同错误风格（要么都返回 error，要么都用 result type）。

---

## 项目特定错误码

TODO: 列出项目核心错误码
