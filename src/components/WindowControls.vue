<template>
  <div class="titlebar" @dblclick="handleDoubleClick">
    <div class="window-controls">
      <button class="window-btn minimize" @click="handleMinimize" title="最小化">
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor"/>
        </svg>
      </button>
      <button class="window-btn maximize" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="0" y="2" width="8" height="8" fill="#252526" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
      <button class="window-btn close" @click="handleClose" title="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { windowMinimize, windowMaximize, windowClose, windowIsMaximized } from '../api'

export default defineComponent({
  name: 'WindowControls',

  data() {
    return {
      isMaximized: false
    }
  },

  async mounted() {
    this.isMaximized = await windowIsMaximized()
  },

  methods: {
    handleMinimize() {
      windowMinimize()
    },

    async handleMaximize() {
      await windowMaximize()
      this.isMaximized = await windowIsMaximized()
    },

    handleClose() {
      windowClose()
    },

    handleDoubleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('.window-controls')) return
      this.handleMaximize()
    }
  }
})
</script>

<style scoped>
.titlebar {
  height: 38px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99998;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  -webkit-app-region: no-drag;
  margin-left: auto;
}

.window-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: #d4d4d4;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.window-btn:hover {
  background: #3e3e42;
}

.window-btn.close:hover {
  background: #e81123;
  color: #fff;
}

.window-btn:active {
  background: #4e4e4e;
}

.window-btn.close:active {
  background: #bf0f1d;
}
</style>
