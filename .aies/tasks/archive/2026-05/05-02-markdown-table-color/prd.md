# 修复: 预览模式 markdown 表格字体颜色看不清

## Bug 描述

**现象**: 点击眼睛图标进入预览模式后,markdown 表格内的文字颜色极差,几乎看不清。

**根因分析**:
- marked 解析输出的 table td 元素没有明确的文字颜色样式
- 缺少偶数行交替背景色,整体可读性差

## 技术方案

修改 `src/components/CodeEditor.vue` 的样式:

1. 给 `.preview-container :deep(td)` 添加 `color: #333333`
2. 添加偶数行交替背景色 `.preview-container :deep(tr:nth-child(even))`

## 已实施的修复

- 第 691-695 行: 添加 td color
- 第 701-703 行: 添加偶数行背景色

## 验证方式

打开包含表格的 markdown 文件 → 点击眼睛图标 → 检查表格内文字是否清晰可读