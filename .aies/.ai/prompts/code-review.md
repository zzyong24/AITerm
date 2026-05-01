# Prompt 模板：代码审查

## 适用场景

让 AI 按清单审查代码（自己生成的 / 他人提交的）。

---

## 模板

```
请审查 {{PROJECT_NAME}} 项目中的以下代码，按 `.ai/review-checklist.md` 的 8-9 大维度逐项检查。

## 待审查范围
{填写文件路径或 git diff 范围}
示例：
- `api/agent_api.go`
- `internal/service/agent_service.go`
- 或 `git diff main...feature/xxx`

## 审查深度
- [ ] 基础：仅过架构 + 错误处理 + AI 盲区三类
- [ ] 完整：过所有 9 大维度
- [ ] 深度：完整 + 性能分析 + 安全审计

## 输出格式
对每个文件输出：
- ✅ 通过的检查项（简略）
- ❌ 未通过的检查项（必须：具体行号 + 问题描述 + 修复建议 + 风险等级）
- ⚠️ 建议改进项（不阻塞但建议优化）
- 💡 潜在风险（未来可能成为问题）

## 重要要求
- 不要泛泛而谈，必须给出具体行号
- 未通过项按风险等级排序：🔴 高 > 🟠 中 > 🟡 低
- 最后给出「可否合并」的结论
```

---

## 示例

```
请审查 api/workspace_api.go 和 internal/service/workspace_service.go 两个新增文件，按 review-checklist.md 完整审查。

重点关注：
1. 四层架构合规
2. Update DTO 是否用指针
3. 事务完整性（workspace 删除是否级联）
4. Swagger 注释是否完整
```
