# 编辑器关闭操作未持久化到SQLite

## 需求背景

用户在 AITerm 中关闭一个编辑器 Tab 后重启应用，关闭的编辑器会再次出现。根本原因是两个缺陷叠加：

**缺陷 A**：`server/routes.mjs` 中 `/api/save-editors` 路由是空实现 stub，直接返回 `{ success: true }` 不写 SQLite。  
**缺陷 B**：`AppBusiness.ts` 的 `closeEditor()` 方法只调用 `scheduleSaveEditors()`（走 stub，什么都不做），从不调用 `removeEditor(projectId, editorId)` 从 SQLite 删除对应记录。

结果：关闭编辑器后内存状态正确，SQLite 中记录未删除，重启后 `loadEditors()` 重新拉出已关闭的编辑器。

## 涉及文件

- `server/routes.mjs` — `/api/save-editors` stub（缺陷 A）
- `src/store/AppBusiness.ts` — `closeEditor()` 缺少 `removeEditor()` 调用（缺陷 B）
- `src/api/http.ts` — `removeEditor()` 已正确实现，只是没被调用

## 技术方案

### 方案（推荐）

1. **修复 `closeEditor()`**：在 `AppBusiness.ts` 的 `closeEditor()` 中，于移除内存状态后额外调用 `removeEditor(projectId, editorId)`。

2. **修复 `save-editors` stub**：将 stub 改为真正 upsert SQLite，或直接废弃该接口（统一走 `removeEditor` + `updateEditors` 精确操作）。

## 优先级

P0 — 直接导致数据与显示不一致，影响基本可用性。
