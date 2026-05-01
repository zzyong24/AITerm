# 日志规范

> 统一的日志格式、级别、字段约定，让日志可被机器检索、人类可读。

---

## 核心原则

1. **结构化日志**：使用 key-value 字段，不拼接字符串
2. **日志即文档**：通过日志能重建业务路径
3. **敏感信息脱敏**：密码、token、身份证等不得记录
4. **级别合理**：debug/info/warn/error 各司其职

---

## 日志级别

| 级别 | 使用场景 | 示例 |
|------|---------|------|
| `debug` | 开发调试信息，生产默认关闭 | 变量值、执行路径 |
| `info` | 正常业务流程的关键节点 | 请求进入、任务完成 |
| `warn` | 非预期但不影响功能 | 降级、重试、慢请求 |
| `error` | 需要人工关注的错误 | 业务异常、外部依赖失败 |
| `fatal` | 不可恢复错误，进程退出 | 初始化失败 |

---

## 必须字段

每条日志必须包含：

| 字段 | 来源 | 说明 |
|------|-----|------|
| `time` | 自动 | 时间戳（建议 ISO 8601 + UTC） |
| `level` | 自动 | 日志级别 |
| `msg` | 手动 | 日志消息（简短、语义化） |
| `trace_id` | ctx | 链路追踪 ID |
| `user_id` | ctx | 当前用户 ID（登录场景） |

---

## 业务字段建议

按模块附加结构化字段：

```
logger.Info(ctx, "user login success",
    zap.String("user_id", userID),
    zap.String("ip", clientIP),
    zap.String("login_type", "password"),
)

logger.Error(ctx, "order create failed",
    zap.String("order_id", orderID),
    zap.String("user_id", userID),
    zap.Error(err),
)
```

---

## 禁止模式

### ❌ 禁止 1：拼接字符串

```
// ❌ 错误
log.Printf("user %s login from %s", userID, ip)

// ✅ 正确
logger.Info(ctx, "user login",
    zap.String("user_id", userID),
    zap.String("ip", ip),
)
```

### ❌ 禁止 2：记录敏感信息

```
// ❌ 错误
logger.Info(ctx, "user login",
    zap.String("password", req.Password),  // 密码!
    zap.String("token", req.Token),        // token!
)

// ✅ 正确：敏感字段脱敏或不记录
logger.Info(ctx, "user login",
    zap.String("user_id", userID),
    zap.String("token_prefix", token[:8]+"..."),  // 仅前缀
)
```

### ❌ 禁止 3：高频日志在热路径

循环内的日志要克制，避免日志放大：

```
// ❌ 错误：每条数据都打日志
for _, item := range items {
    logger.Info(ctx, "processing item", ...)
}

// ✅ 正确：批次统计
logger.Info(ctx, "processing batch",
    zap.Int("count", len(items)),
    zap.Duration("elapsed", time.Since(start)),
)
```

### ❌ 禁止 4：日志代替错误返回

```
// ❌ 错误：只打日志不返回错误
if err != nil {
    logger.Error(ctx, "failed", zap.Error(err))
    return nil   // 上层以为成功了!
}

// ✅ 正确：日志 + 返回错误
if err != nil {
    logger.Error(ctx, "failed", zap.Error(err))
    return errno.ErrXxx
}
```

---

## 敏感字段清单

以下字段**禁止**直接记录（需脱敏或省略）：

- 密码、密钥、token、cookie、session
- 身份证、银行卡、手机号（部分脱敏可）
- 个人隐私（地址、真实姓名 - 按业务判断）
- 内部 SQL、堆栈（生产环境）

---

## 项目特定日志规范

TODO: 填写项目特有的日志要求，如：
- 审计日志格式
- 特定事件埋点
- 链路追踪标准（OpenTelemetry 等）
