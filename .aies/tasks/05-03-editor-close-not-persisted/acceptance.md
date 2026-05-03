# 验收与测试：编辑器关闭操作未持久化到SQLite

> ⚠️ 本文件必须在 implement 阶段开始前填写完毕。

## P0 验收场景

| # | 场景 | 操作 | 期望结果 |
|---|------|------|--------|
| AC-01 | 关闭编辑器后重启 | 打开文件 A，关闭 Tab，重启 AITerm | 文件 A 的 Tab 不再出现 |
| AC-02 | 多编辑器场景 | 打开文件 A、B、C，关闭 B，重启 | 只显示 A、C，不显示 B |
| AC-03 | Electron 模式 | 在 Electron 中关闭 Tab，重启 | SQLite editors 表中无该 editorId 记录 |
| AC-04 | 浏览器模式 (5173) | 在浏览器中关闭 Tab，重启 | SQLite editors 表中无该 editorId 记录 |
| AC-05 | 关闭不存在的 editor | 关闭一个已从文件系统删除的文件的 Tab | 不报错，正常关闭 |

## 验收通过标准

- [ ] 所有 P0 场景通过
- [ ] SQLite `editors` 表在关闭 Tab 后立即删除对应记录（可用 DB Browser 验证）
- [ ] `save-editors` HTTP 接口不再是 stub（或已废弃并有对应单元测试）
