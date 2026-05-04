<template>
  <div class="titlebar" @dblclick="handleDoubleClick">
    <div class="titlebar-tools">
      <button class="tool-btn" @click="handleRefreshProjects" title="刷新项目列表">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
      <button class="tool-btn tool-btn--danger" @click="showClearStateConfirm = true" title="清空终端和编辑器记录（保留项目列表）">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
        <span>清空</span>
      </button>
      <button class="tool-btn" @click="showKillPortModal = true" title="终止端口进程">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
        <span>Kill Port</span>
      </button>
    </div>

    <div class="window-controls">
      <button class="window-btn minimize" @click="handleMinimize" title="最小化">
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button class="window-btn maximize" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0" y="0" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1" />
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1" />
          <rect x="0" y="2" width="8" height="8" fill="#252526" stroke="currentColor" stroke-width="1" />
        </svg>
      </button>
      <button class="window-btn close" @click="handleClose" title="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>

    <!-- 清空状态确认对话框 -->
    <div v-if="showClearStateConfirm" class="modal-overlay" @click="showClearStateConfirm = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <span>清空终端和编辑器记录</span>
          <button class="modal-close" @click="showClearStateConfirm = false">×</button>
        </div>
        <div class="modal-body">
          <p>将关闭所有运行中的终端，并清空 SQLite 中的终端和编辑器记录。</p>
          <p class="close-warning">此操作不可撤销，项目列表不受影响。</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showClearStateConfirm = false">取消</button>
          <button class="btn-confirm btn-close" :disabled="isClearingState" @click="handleClearAllState">
            {{ isClearingState ? '清空中...' : '确认清空' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Kill Port Modal -->
    <div v-if="showKillPortModal" class="modal-overlay" @click="showKillPortModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <span>终止端口进程</span>
          <button class="modal-close" @click="showKillPortModal = false">×</button>
        </div>
        <div class="modal-body">
          <label>
            端口号
            <input v-model="killPortInput" type="number" placeholder="例如: 3001" @keydown.enter="handleKillPort"
              autofocus />
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showKillPortModal = false">取消</button>
          <button class="btn-confirm" @click="handleKillPort">终止</button>
        </div>
      </div>
    </div>

    <!-- 关闭确认对话框 -->
    <div v-if="showCloseConfirm" class="modal-overlay" @click="showCloseConfirm = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <span>确认关闭</span>
          <button class="modal-close" @click="showCloseConfirm = false">×</button>
        </div>
        <div class="modal-body">
          <p v-if="openTerminalsCount > 0">
            即将关闭所有打开的终端 ({{ openTerminalsCount }} 个)。
          </p>
          <p>确定要关闭 AITerm 吗？</p>
          <p class="close-warning">终端会话将在下次启动时自动恢复。</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCloseConfirm = false">取消</button>
          <button class="btn-confirm btn-close" @click="confirmClose">确定关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { windowMinimize, windowMaximize, windowClose, windowIsMaximized, killPort, getOpenTerminalsCount } from '../api'
import { appBusiness } from '../store/AppBusiness'
export default defineComponent({
  name: 'WindowControls',

  data() {
    return {
      isMaximized: false,
      showKillPortModal: false,
      killPortInput: '',
      showCloseConfirm: false,
      openTerminalsCount: 0,
      showClearStateConfirm: false,
      isClearingState: false
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

    async handleClose() {
      this.openTerminalsCount = await getOpenTerminalsCount()
      this.showCloseConfirm = true
    },

    confirmClose() {
      this.showCloseConfirm = false
      // 直接关闭窗口，PTY 进程由 electron/main.ts before-quit 的 ptyService.closeAll() 统一处理。
      // ❌ 不在这里调 closeSession()：那会把 SQLite 的终端记录删掉，
      //    导致下次启动 restoreAllTerminals() 找不到记录，终端无法恢复。
      windowClose()
    },

    handleDoubleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('.window-controls') || target.closest('.titlebar-tools')) return
      this.handleMaximize()
    },

    handleRefreshProjects() {
      appBusiness.refreshProjects()
    },

    async handleClearAllState() {
      if (this.isClearingState) return
      this.isClearingState = true
      try {
        await appBusiness.clearAllState()
        this.showClearStateConfirm = false
      } catch (e) {
        console.error('[WindowControls] clearAllState failed:', e)
      } finally {
        this.isClearingState = false
      }
    },

    async handleKillPort() {
      const port = parseInt(this.killPortInput)
      if (isNaN(port) || port <= 0) {
        return
      }
      try {
        await killPort(port)
        this.showKillPortModal = false
        this.killPortInput = ''
      } catch (e) {
        console.error('Failed to kill port:', e)
      }
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
  justify-content: space-between;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99998;
}

.titlebar-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 12px;
  -webkit-app-region: no-drag;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: #3e3e42;
  border-color: #007acc;
}

.tool-btn--danger {
  border-color: #5a2020;
  color: #e07070;
}

.tool-btn--danger:hover {
  background: #3e2020;
  border-color: #c42b1c;
  color: #ff8080;
}

.tool-btn svg {
  width: 14px;
  height: 14px;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
  -webkit-app-region: no-drag;
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

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

.modal {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  width: 320px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  font-weight: 500;
  color: #333333;
}

.modal-close {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #333333;
}

.modal-body {
  padding: 16px;
}

.modal-body label {
  display: block;
  font-size: 12px;
  color: #666666;
  margin-bottom: 8px;
}

.modal-body p {
  font-size: 13px;
  color: #333333;
  margin: 0 0 8px 0;
}

.modal-body input {
  width: 100%;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  font-size: 14px;
  outline: none;
}

.modal-body input:focus {
  border-color: #007acc;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #d4d4d4;
  color: #333333;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.btn-confirm {
  background: #007acc;
  border: none;
  color: #fff;
}

.btn-confirm:hover {
  background: #005a9e;
}

.close-warning {
  color: #c42b1c;
  font-size: 12px;
  margin-top: 4px;
}

.btn-close {
  background: #c42b1c;
}

.btn-close:hover:not(:disabled) {
  background: #a02622;
}
</style>
