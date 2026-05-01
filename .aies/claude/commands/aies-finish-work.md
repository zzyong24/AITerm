# /aies:finish-work

完成当前任务，执行 Phase 3 完整收尾流程。

## 执行步骤

1. 输出 Phase 3 任务完成清单（质量自检 + 测试验收）
2. 检查 `.ai/index.md` 是否需要更新，如需要直接更新
3. 生成建议的 commit message
4. 生成完整的 `session.py add` 命令供用户复制执行：

```bash
python3 .aies/scripts/session.py add \
    --title "{本次会话标题}" \
    --commit "$(git rev-parse --short HEAD)" \
    --summary "{变更摘要}"
```

5. **⭐ Spec 回流（强制，必须输出答案）**：

回答以下 3 个问题，不能跳过：
- Q1: 本次有没有"应该统一规范"的地方？
- Q2: 有没有踩坑，下次需要提前规避？
- Q3: `.aies/spec/guides/` 是否需要新增场景？

如果任意答案为"是"：
- 判断归属的 spec 文件（architecture/code-style/error-handling/quality-gates/guides/{topic}）
- 直接修改该文件，追加新约定（带 ✅/❌ 示例）
- 在 `.ai/changelog.md` 追加：`- {今日日期}: [{spec 文件名}] {一句话描述}`

如果全部为"否"：输出 `Spec 回流：无新约定`，不能沉默。

