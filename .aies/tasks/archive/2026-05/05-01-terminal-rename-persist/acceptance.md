# 验收与测试：Terminal 重命名与持久化

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 输入 | 期望结果 |
|---|------|------|--------|
| AC-01 | 手动重命名 | 点击 tab，输入"前后端联调"回车 | Tab 显示"前后端联调"，持久化到文件 |
| AC-02 | Agent API 命名 | POST /terminal/:id/rename { name: "修复登录 bug" } | Tab 显示"修复登录 bug" |
| AC-03 | 重启恢复 | 关闭 App 后重新打开 | 所有 Terminal 自动恢复，名称/cwd/history 保持 |
| AC-04 | 超长名称截断 | 输入超过 10 字的名称 | Tab 显示前 8 字 + "..."，不撑开 tab 宽度 |
| AC-05 | 多 Terminal 并存 | 打开 3 个 Terminal 分别重命名 | 各自独立、互不干扰 |
| AC-06 | 编辑器持久化 | 打开一个 md 文件，刷新页面 | 文件重新出现在 Tab 中 |

## 验收通过标准

- [x] 所有 P0 场景通过（AC-01 ~ AC-06 全部实现）
- [x] Playwright E2E 测试覆盖 AC-01, AC-03, AC-05