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

## Vitest 环境配置

### ✅ 必须：vitest 环境设为 `node`

```ts
// vite.config.ts / vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',  // ← 必须，不能用默认 'jsdom'
  }
})
```

**原因**：`html-encoding-sniffer`（`whatwg-url` 依赖链）仅支持 ESM，在 `jsdom` 环境下会报
`SyntaxError: The requested module … does not provide an export named 'default'`。
设为 `node` 后 Vitest 不加载 jsdom，可以正常跑 AppBusiness 单元测试。

---

## E2E 条件跳过（Playwright）

### 规则：基础设施不可用时必须 skip，不能直接报错

**场景**：测试依赖 Electron（端口 5003）、外部服务、或只在打包环境才有的功能。

```typescript
test('AC-01: 某部署测试', async ({ page }) => {
  // ✅ 先探针，不可达则跳过
  const ctx = await request.newContext()
  const reachable = await ctx
    .get('http://localhost:5003', { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  await ctx.dispose()

  if (!reachable) {
    test.skip(true, 'Port 5003 not reachable — Electron app not running, skipping')
    return  // ← 必须 return，test.skip 不会自动中断
  }

  // ... 实际测试逻辑
})
```

❌ 错误：直接 `page.goto('http://localhost:5003')` → `ERR_CONNECTION_REFUSED` → 测试报错

---

## Native 模块版本匹配

### 规则：Node.js 版本变更后必须 rebuild

当出现 `NODE_MODULE_VERSION mismatch`（如 `better-sqlite3` 编译版本与运行时不一致）：

```bash
npm rebuild better-sqlite3
```

**背景**：`better-sqlite3` 是 Node.js native addon，绑定到编译时的 Node.js ABI 版本。
升级/切换 Node.js 版本后必须重新编译，否则所有测试在 require 阶段就会 crash。

---

## 覆盖率要求

| 类型 | 最低要求 |
|------|---------|
| 核心业务函数 | 80% 分支覆盖 |
| 边界条件 | 必须覆盖 |
| 异常路径 | 必须覆盖 |
