# Prompt 模板库

本目录存放项目常用任务的 Prompt 模板。

## 现有模板

| 模板 | 适用场景 |
|------|---------|
| `new-feature.md` | 新增功能 / API / 模块 |
| `fix-bug.md` | 修复 Bug |
| `code-review.md` | 代码审查 |
| `git-commit.md` | Git 代码提交 |
| `refactor.md` | 重构 |

## 使用

### 方式 1：AI 自动触发

在 CodeBuddy / Cursor / Claude 中直接说：
- 「帮我新增 XXX 功能」 → AI 自动读取 `new-feature.md`
- 「帮我修复 XXX Bug」 → AI 自动读取 `fix-bug.md`
- 「审查这段代码」 → AI 自动读取 `code-review.md`

### 方式 2：手动复制粘贴

打开对应模板，复制内容到对话中。

## 新增模板原则

1. **发现重复操作** → 考虑模板化
2. **模板必须可执行**（包含该读哪些文件、输出什么格式）
3. **给出具体示例**
4. **列出检查点**（AI 必须做到哪些事）

## 命名约定

- 动词-名词：`new-feature.md`、`fix-bug.md`、`refactor.md`
- 全小写，kebab-case
