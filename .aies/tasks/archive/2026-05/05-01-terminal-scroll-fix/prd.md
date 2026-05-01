# 修复终端滚动卡顿

## 需求背景

终端在处理大量输出时（如 Claude session 运行），滚动出现明显卡顿，用户体验差。需要提升滚动性能，并增加交互式等待/命令失败的智能检测。

## 技术方案（已实现）

### 1. WebGL 渲染器

引入 `@xterm/addon-webgl` addon，替代默认 Canvas 渲染器，显著提升滚动和渲染性能：

```typescript
import { WebglAddon } from '@xterm/addon-webgl'
this.webglAddon = new WebglAddon()
terminal.loadAddon(this.webglAddon)
```

### 2. 交互式等待检测（WAITING_PATTERNS）

当终端出现以下模式时，触发 ActivityPanel 提醒：

| Pattern | Reason |
|---------|--------|
| `\[Y/n\]`, `\[y/N\]` | 等待确认 |
| `Press any key`, `Press Enter` | 等待按键 |
| `password:` | 等待密码 |
| `Selection:`, `Choose.*option` | 等待选择 |

### 3. 命令失败检测（FAILED_PATTERNS）

| Pattern | Reason |
|---------|--------|
| `\+\d+ lines? \(ctrl\+o to expand\)` | 输出截断 |
| `\berror\b`, `\bfailed\b` | 命令失败 |
| `command not found` | 命令未找到 |
| `permission denied` | 权限不足 |

### 4. Prompt 检测（PROMPT_PATTERNS）

通过检测常见命令提示符判断命令是否执行完成：

```typescript
const PROMPT_PATTERNS = [
  /^[❯›▶]\s*/m,  // Claude UI prompt
  /^>\s*/m,       // 通用 prompt
  /^\$\s*/m,      // bash prompt
  /^#\s*/m,       // root prompt
  /^%(?!\s)/m,    // zsh prompt
]
```

### 5. ActivityPanel 集成

- `appBusiness.addWaitingForInput(id, reason)` — 标记需要干预
- `appBusiness.clearWaitingForInput(id)` — 用户输入后清除提醒
- `appBusiness.addActivity(id, bytes)` — 活跃度跟踪

## 影响范围

- 修改文件：`src/components/Terminal.vue`
- 新增依赖：`@xterm/addon-webgl`（已引入）

## 状态跟踪机制

```typescript
detectedWaiting: boolean     // 是否已检测到需要干预的状态
hasOutputSinceInput: boolean // 用户输入后是否有新输出
hasCommandOutput: boolean   // 是否有实质命令输出
```

## 已知问题

- WebGL 在某些环境下可能不支持，需要 fallback 机制
- prompt 检测可能出现误判
- 尚未编写 E2E 测试覆盖交互检测场景
