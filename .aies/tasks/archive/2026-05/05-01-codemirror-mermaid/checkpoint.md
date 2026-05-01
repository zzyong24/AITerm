# Checkpoint: CodeEditor 支持 Mermaid 渲染

## 当前状态

- **阶段**：✅ COMPLETED
- **最后更新**：2026-05-01 20:58:51

## Bug 修复记录
- **Bug-01**：眼睛图标不显示
  - 根因：isMarkdown 只在 handleEditorsChange 设置，initEditor 调用时未同步
  - 修复：在 initEditor 开头添加 this.isMarkdown = !!this.currentEditor?.path?.match(/\.(md|markdown)$/i)

- **Bug-02**：预览模式文字看不清
  - 根因：mermaid 默认使用深色主题，与浅色容器冲突
  - 修复1：theme 改为 'base' 并配置 themeVariables 为浅色系
  - 修复2：移除 SVG rect 元素的深色 fill
  - 修复3：预览容器所有文字颜色强制设为 #333333

## e2e 测试结果
```
✓ 预览切换按钮在 markdown 文件时可见 (515ms)
✓ mermaid 图表正确渲染为 SVG (211ms)
2 passed (1.4s)
```

## 修改文件
- `src/components/CodeEditor.vue` — Bug-01 + Bug-02 修复
