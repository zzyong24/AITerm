# Terminal 重命名与持久化

## 需求背景
并行开发时多个 Terminal 同时跑不同 Claude session，需要区分+恢复现场。

## 验收标准

### AC-01 手动重命名
- 点击 Terminal 标签页 → 输入新名称 → 回车确认
- 名称立即保存并显示
- 特殊字符限制：仅支持中文、英文、`-`、`_`
- 长度建议 10 字符内，超长显示 `...` 截断

### AC-02 Agent API 命名
- Agent 可调用 `POST /terminal/:id/rename` 接口
- 请求体：`{ "name": "xxx" }`
- 命名规则同手动：中文/英文/`-`/`_`，长度不限制
- 成功返回更新后的 terminal 状态

### AC-03 重启自动恢复
- 关闭应用再打开，所有 Terminal 自动恢复到上次状态
- 恢复内容：名称、cwd、session history、lastActiveAt

### AC-04 多 Terminal 并存
- 多个 Terminal 可同时存在，互不干扰
- 每个 Terminal 有独立 ID、名称、cwd、history

### AC-05 编辑器持久化
- 打开的文件自动保存到 `~/.aiterm/history/{project}/editors.json`
- 重启后自动恢复所有打开的编辑器
- 保存内容：id、path、name、scrollToLine

## 技术方案

### 持久化存储
- 路径：`~/.aiterm/sessions/terminal-{id}.json`
- 每个 Terminal 一个 JSON 文件

### 状态结构
```json
{
  "id": "uuid",
  "name": "task-xxx 开发",
  "cwd": "/path/to/project",
  "taskSlug": "05-01-xxx",
  "history": ["cmd1", "cmd2"],
  "createdAt": "timestamp",
  "lastActiveAt": "timestamp"
}
```

### Agent API
- `POST /terminal/:id/rename`
  - Body: `{ "name": "xxx" }`
  - Returns: 更新后的 terminal 状态

### UI 约束
- Tab 宽度固定，不随名称增长而拓宽
- 超长名称显示 `...` 截断

## 依赖
- node-pty（已引入）
- Express server（已有）