# Thinking Guide — 浏览器内嵌

> 适用场景：在 Electron 应用中内嵌外部网页（BrowserView 功能）

---

## 核心原则：必用 `<webview>`，禁用 `<iframe>`

| | `<iframe>` | `<webview>` |
|---|---|---|
| X-Frame-Options / CSP | 被拦截 → 白屏 | 独立渲染进程，绕过限制 |
| 缩放 | CSS transform（布局溢出） | `setZoomFactor()` 原生支持 |
| 加载事件 | `onload`（不可靠） | `did-finish-load` / `did-fail-load` |

## 前置条件

`electron/main.ts` 的 `webPreferences` 必须加：

```typescript
webviewTag: true  // 允许渲染进程使用 <webview> 标签
```

## 缩放

```typescript
// ✅ 正确：原生 API，布局正常
webview.setZoomFactor(zoom / 100)

// ❌ 错误：CSS transform 会导致 webview 溢出容器
// style="transform: scale(0.8)"
```

## 事件处理

```typescript
// did-finish-load 里调用 getURL() 需 try/catch（偶发初始化异常）
handleWebviewLoad() {
  try {
    const url = wv.getURL()
    // ...
  } catch {
    // 忽略，页面未完全初始化时偶发
  }
}

// did-fail-load 不会崩溃，正常处理即可
handleWebviewFailLoad(_event: Event) {
  console.warn('[BrowserView] webview failed to load')
}
```

## URL 同步

页面内跳转（`<a>` 点击等）会改变 webview 的实际 URL，需在 `did-finish-load` 里把 `getURL()` 同步回工具栏：

```typescript
const currentUrl = wv.getURL()
if (currentUrl && currentUrl !== this.url) {
  this.url = currentUrl
  appBusiness.updateBrowserUrl(browserId, currentUrl)
}
```
