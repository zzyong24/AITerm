# 测试规范

> 本文件定义项目的测试规范。AI 生成代码必须遵循。

---

## 测试框架

- **单元测试**：Vitest + @vue/test-utils
- **E2E 测试**：Playwright

---

## 单元测试规范

### 测试文件位置

```
tests/
└── AppBusiness.test.ts   # AppBusiness 单元测试
```

### 测试文件命名

- 文件：`{被测模块}.test.ts`
- 函数：`test_{场景}_{期望结果}`

示例：
```typescript
test('createSession should return sessionId', async () => {
    const sessionId = await appBusiness.createSession('project-1', 'Test Project', '/tmp')
    expect(sessionId).toBeTruthy()
})
```

### Mock 规范

使用 Vitest 的 `vi.mock()` 和 `vi.spyOn()`：

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock API 模块
vi.mock('../src/api', () => ({
    createTerminalSession: vi.fn().mockResolvedValue('session-123')
}))
```

---

## 验收标准

### 必须覆盖的场景

1. **正常路径**：核心功能正常工作
2. **空值处理**：null/undefined/空数组 输入不崩溃
3. **边界条件**：超长输入、超大数值
4. **错误处理**：API 失败时正确降级

### 禁止事项

- ❌ 发真实网络请求（全部 mock）
- ❌ 依赖执行顺序（测试必须独立）
- ❌ 测试中写 `console.log` 用于调试后忘记移除
- ❌ Happy Path only（必须有异常场景测试）

---

## 运行测试

```bash
# 运行所有测试
npm run test

# 运行单元测试
npm run test:unit

# E2E 测试
npm run test:e2e

# 监听模式
npm run test -- --watch
```

---

## 覆盖率要求

| 类型 | 最低要求 |
|------|---------|
| 核心业务函数 | 80% 分支覆盖 |
| 边界条件 | 必须覆盖 |
| 异常路径 | 必须覆盖 |
