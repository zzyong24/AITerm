# CodeEditor 支持 Mermaid 渲染

## 需求背景

用户在 CodeEditor 中打开 Markdown 文件时，需要能够渲染 Mermaid 图表。当前实现采用"编辑/预览切换模式"（类似 Typora/GitHub）：编辑模式编辑 markdown，预览模式渲染 Mermaid 图表。

工具栏添加眼睛图标按钮，仅 markdown 文件显示。

## 技术方案（草稿）

### 实现模式：编辑/预览切换

- 工具栏眼睛图标按钮切换预览状态
- 预览状态：marked 解析 markdown + mermaid 渲染代码块
- 非预览状态：CodeMirror 编辑器正常编辑

### 影响范围

- 修改文件：`src/components/CodeEditor.vue`
- 新增依赖：mermaid, marked（已引入）

## 当前存在的 Bug

### Bug 1: 小眼睛按钮在文件打开时不显示，只在刷新后才出现

**现象**：
- 打开 `.md` 文件时，工具栏没有显示眼睛图标按钮
- 只有在手动刷新后，按钮才出现

**根因分析**：
- `isMarkdown` 只在 `handleEditorsChange` 中设置
- 当通过 watcher 触发 `initEditor` 时（文件切换或内容变化），`isMarkdown` 不会重新计算
- 导致 `v-if="isMarkdown"` 为 false，按钮不显示

**修复方案**：
- 在 `initEditor` 或 watcher handler 中同步计算 `isMarkdown`

### Bug 2: 点击小眼睛预览后，文档背景色和字体颜色展示效果极差

**现象**：
- 点击预览后，文字几乎看不清
- 可能原因：mermaid 的 SVG 样式与容器样式冲突，或 marked 解析的 HTML 结构有问题

**根因分析**：
- mermaid 配置使用 `theme: 'default'`，可能使用了深色背景但容器是白色
- 或者 marked 解析的代码块背景与文字颜色不匹配

**修复方案**：
- 尝试使用 `theme: 'neutral'` 或 `theme: 'dark'` 配合深色容器
- 或强制为 mermaid SVG 设置 `background: transparent`
- 验证 marked 解析输出的 HTML 结构是否正确

## 🤔 Agent 的不确定点

1. mermaid 主题配置是否需要根据当前编辑器主题动态切换？
2. 是否需要处理 mermaid 渲染失败的情况（如图表语法错误）？
