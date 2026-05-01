# ai-terminal 变更日志

> 每次变更后在此追加记录。格式：`| 日期 | 变更内容 | 涉及文件 |`

| 日期 | 变更内容 | 涉及文件 |
|------|---------|---------|
| 2026-05-01 | 初始化 AI 工程化脚手架（AIES） | `.ai/`、`.aies/`、平台入口文件 |
| 2026-05-01 | 填充 AIES 模板文件 | `.ai/index.md`、`.aies/spec/architecture.md`、`.aies/spec/code-style.md`、`.aies/spec/testing.md` |
| 2026-05-01 | 终端滚动卡顿修复：添加 @xterm/addon-webgl | `Terminal.vue` |
| 2026-05-01 | CodeEditor Markdown 预览模式：编辑/预览切换，Preview 模式渲染 Mermaid | `CodeEditor.vue` |
| 2026-05-01 | 修复 Markdown 预览 Bug: (1) marked v18 API 适配 (2) mermaid render 返回值处理 (3) 预览样式优化 | `CodeEditor.vue` |
| 2026-05-01 | Terminal 重命名与持久化：Tab 双击重命名、API 重命名、自动恢复、多 Terminal 并存 | `AppBusiness.ts`, `ProjectContent.vue`, `server/index.mjs`, `api/http.ts` |
| 2026-05-01 | 编辑器持久化：打开的文档自动保存/恢复，Tab 变化时实时持久化 | `AppBusiness.ts`, `server/index.mjs`, `api/http.ts` |
