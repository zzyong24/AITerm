# PRD — Terminal 浏览器白屏修复

## 背景

AITerm 内嵌了一个"浏览器"功能（BrowserView.vue），允许用户在 IDE 内打开网页。当前实现使用 `<iframe>` 加载外部 URL，导致绝大多数网站（GitHub、Google、本地 localhost 以外的服务）白屏。

## 根本原因

1. **X-Frame-Options / CSP 拦截**：现代网站响应头携带 `X-Frame-Options: DENY` 或 `Content-Security-Policy: frame-ancestors 'none'`，浏览器强制拒绝 `<iframe>` 加载，页面显示空白。
2. **Electron 未启用 webviewTag**：`electron/main.ts` 的 `webPreferences` 缺少 `webviewTag: true`，无法使用 Electron 原生 `<webview>` 组件。

## 目标

将 BrowserView.vue 的渲染方式从 `<iframe>` 改为 Electron 原生 `<webview>` 标签，彻底解决白屏问题，同时保持工具栏（刷新、URL 输入、缩放）功能完整。

## 范围

仅修改两个文件：
- `electron/main.ts` — 开启 `webviewTag: true`
- `src/components/BrowserView.vue` — 替换 `<iframe>` 为 `<webview>`，适配新 API

## 不做的事

- 不新增浏览器 Tab 管理逻辑
- 不修改 AppBusiness.ts 中的 BrowserTab 类型
- 不处理 devtools 开关（后续需求）
