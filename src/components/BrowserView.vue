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
    <div class="browser-content" ref="browserContent">
      <iframe
        ref="iframeRef"
        :src="currentBrowser.url"
        :style="{ transform: `scale(${currentBrowser.zoom / 100})` }"
        @load="handleIframeLoad"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  </div>
  <div v-else class="no-browser">
    没有打开的浏览器
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
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
      url: '',
      iframeKey: 0
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

    handleLoadUrl() {
      if (!this.currentBrowser || !this.url.trim()) return

      let url = this.url.trim()
      // 如果没有协议，添加 https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }

      appBusiness.updateBrowserUrl(this.currentBrowser.id, url)
      this.url = url

      // 重新加载 iframe
      this.$nextTick(() => {
        this.reloadIframe()
      })
    },

    handleRefresh() {
      this.reloadIframe()
    },

    reloadIframe() {
      if (this.$refs.iframeRef) {
        const iframe = this.$refs.iframeRef as HTMLIFrameElement
        iframe.src = iframe.src
      }
    },

    handleIframeLoad() {
      console.log('[BrowserView] iframe loaded')
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

.browser-content iframe {
  width: 100%;
  height: 100%;
  border: none;
  transform-origin: top left;
  background: #ffffff;
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
