<template>
  <div class="browser-view" v-if="currentBrowser">
    <!-- 工具栏 -->
    <div class="browser-toolbar">
      <button class="toolbar-btn" @click="handleRefresh" title="刷新">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
      </button>
      <input
        ref="urlInput"
        v-model="url"
        class="url-input"
        type="text"
        placeholder="输入 URL 并按回车"
        @keydown.enter="handleLoadUrl"
      />
      <button class="toolbar-btn" @click="zoomOut" title="缩小">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M8 11h6" />
        </svg>
      </button>
      <span class="zoom-level">{{ currentBrowser.zoom }}%</span>
      <button class="toolbar-btn" @click="zoomIn" title="放大">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M8 11h6" />
          <path d="M11 8v6" />
        </svg>
      </button>
    </div>

    <!-- 浏览器内容 -->
    <!-- 使用 <webview> 而非 <iframe>：<iframe> 被 X-Frame-Options/CSP 拦截会白屏，
         <webview> 是 Electron 独立渲染进程，绕过跨域限制，缩放用 setZoomFactor() 原生支持 -->
    <div class="browser-content" ref="browserContent">
      <webview
        ref="webviewRef"
        :src="currentBrowser.url"
        class="browser-webview"
        @did-finish-load="handleWebviewLoad"
        @did-fail-load="handleWebviewFailLoad"
      />
    </div>
  </div>
  <div v-else class="no-browser">
    没有打开的浏览器
  </div>
</template>

<script lang="ts">
import { defineComponent, nextTick } from 'vue'
import { appBusiness, AppEvents, type BrowserTab } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'

export default defineComponent({
  name: 'BrowserView',

  props: {
    browserId: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      browsers: [] as BrowserTab[],
      url: ''
    }
  },

  computed: {
    currentBrowser(): BrowserTab | null {
      if (!this.browserId) return null
      return this.browsers.find(b => b.id === this.browserId) || null
    }
  },

  watch: {
    browserId() {
      this.syncUrl()
    },
    currentBrowser(newBrowser) {
      if (newBrowser && newBrowser.url !== this.url) {
        this.url = newBrowser.url
      }
    },
    // 缩放变化时通过 webview API 应用，避免 CSS transform 导致布局错位
    'currentBrowser.zoom'(newZoom: number) {
      this.applyZoom(newZoom)
    }
  },

  mounted() {
    eventBus.on(AppEvents.BROWSERS_CHANGE, this.handleBrowsersChange)
    this.browsers = [...appBusiness.browsers]
    this.syncUrl()
  },

  beforeUnmount() {
    eventBus.off(AppEvents.BROWSERS_CHANGE, this.handleBrowsersChange)
  },

  methods: {
    handleBrowsersChange(browsers: BrowserTab[]) {
      this.browsers = [...browsers]
      this.syncUrl()
    },

    syncUrl() {
      if (this.currentBrowser) {
        this.url = this.currentBrowser.url
      }
    },

    getWebview(): Electron.WebviewTag | null {
      return (this.$refs.webviewRef as Electron.WebviewTag) || null
    },

    handleLoadUrl() {
      if (!this.currentBrowser || !this.url.trim()) return

      let url = this.url.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }

      appBusiness.updateBrowserUrl(this.currentBrowser.id, url)
      this.url = url

      nextTick(() => {
        const wv = this.getWebview()
        if (wv) {
          wv.src = url
        }
      })
    },

    handleRefresh() {
      const wv = this.getWebview()
      if (wv) {
        wv.reload()
      }
    },

    handleWebviewLoad() {
      const wv = this.getWebview()
      if (!wv) return

      // 同步 webview 实际 URL 到工具栏（处理页面内跳转）
      try {
        const currentUrl = wv.getURL()
        if (currentUrl && currentUrl !== this.url) {
          this.url = currentUrl
          if (this.currentBrowser) {
            appBusiness.updateBrowserUrl(this.currentBrowser.id, currentUrl)
          }
        }
      } catch {
        // getURL() 在 did-finish-load 前调用偶发异常，忽略
      }

      // 恢复缩放
      this.applyZoom(this.currentBrowser?.zoom ?? 100)

      console.log('[BrowserView] webview loaded:', wv.getURL())
    },

    handleWebviewFailLoad(_event: Event) {
      console.warn('[BrowserView] webview failed to load')
    },

    applyZoom(zoom: number) {
      const wv = this.getWebview()
      if (!wv) return
      try {
        // setZoomFactor 是 Electron webview 原生 API，1.0 = 100%
        wv.setZoomFactor(zoom / 100)
      } catch {
        // webview 尚未 ready 时忽略
      }
    },

    zoomIn() {
      if (!this.currentBrowser) return
      appBusiness.updateBrowserZoom(this.currentBrowser.id, this.currentBrowser.zoom + 10)
    },

    zoomOut() {
      if (!this.currentBrowser) return
      appBusiness.updateBrowserZoom(this.currentBrowser.id, this.currentBrowser.zoom - 10)
    }
  }
})
</script>

<style scoped>
.browser-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f3f3f3;
  border-bottom: 1px solid #d4d4d4;
  min-height: 36px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #666666;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: #e0e0e0;
  color: #333333;
}

.url-input {
  flex: 1;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  font-size: 13px;
}

.url-input:focus {
  outline: none;
  border-color: #007acc;
}

.zoom-level {
  font-size: 12px;
  color: #666666;
  min-width: 45px;
  text-align: center;
}

.browser-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: #ffffff;
}

.browser-webview {
  width: 100%;
  height: 100%;
  border: none;
}

.no-browser {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666666;
  font-size: 14px;
}
</style>
