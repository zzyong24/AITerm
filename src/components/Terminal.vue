<template>
  <div class="terminal-wrapper" :class="{ active: isActive }">
    <!-- 子终端切换栏 -->
    <div v-if="children && children.length > 0" class="sub-terminal-bar">
      <button
        class="sub-tab"
        :class="{ active: activeSubId === null }"
        @click="$emit('active-sub-change', id, null)"
      >
        主终端
      </button>
      <button
        v-for="child in children"
        :key="child.id"
        class="sub-tab"
        :class="{ active: activeSubId === child.id, dead: !child.alive }"
        @click="$emit('active-sub-change', id, child.id)"
      >
        子终端 {{ (children || []).indexOf(child) + 1 }}
        <span v-if="!child.alive" class="dead-indicator">×</span>
      </button>
      <button class="sub-tab add-sub" @click="handleSplit" title="拆分终端">+</button>
    </div>

    <div ref="terminalContainer" class="terminal-container"></div>

    <!-- 终端操作按钮 -->
    <div class="terminal-actions">
      <button class="action-btn" @click="handleSplit" v-if="!children || children.length === 0" title="拆分终端">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      </button>
      <button class="action-btn danger" @click="handleClose" title="关闭终端">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { terminalOutputListener, terminalClosedListener, writeToTerminal, resizeTerminal } from '../api'
import { appBusiness } from '../store/AppBusiness'

export default defineComponent({
  name: 'Terminal',

  props: {
    sessionId: {
      type: String,
      required: true
    },
    workingDir: {
      type: String,
      default: '~'
    },
    isActive: {
      type: Boolean,
      default: false
    },
    children: {
      type: Array as () => ChildTerminal[],
      default: () => []
    },
    activeSubId: {
      type: String as () => string | null,
      default: null
    },
    onClose: {
      type: Function as (sessionId: string) => void,
      required: true
    },
    onSplit: {
      type: Function as (sessionId: string) => void,
      required: true
    }
  },

  emits: ['active-sub-change'],

  data() {
    return {
      id: this.sessionId,
      terminal: null as XTerm | null,
      fitAddon: null as FitAddon | null,
      outputUnsubscribe: null as (() => void) | null,
      closedUnsubscribe: null as (() => void) | null,
      userScrolledAway: false // 用户是否向上滚动了，查看历史内容
    }
  },

  watch: {
    isActive(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.fit()
        })
      }
    },

    children(newChildren) {
      // children updated
    },

    sessionId(newVal, oldVal) {
      if (newVal === oldVal) return

      // 取消旧会话的订阅
      if (this.outputUnsubscribe) {
        this.outputUnsubscribe()
        this.outputUnsubscribe = null
      }

      this.id = newVal

      // 订阅新会话
      if (this.terminal) {
        this.outputUnsubscribe = terminalOutputListener((data) => {
          if (data.session_id === this.id) {
            const text = new TextDecoder().decode(new Uint8Array(data.data))
            this.terminal?.write(text)
            // 只有用户没有查看历史时才自动滚动到底部
            if (!this.userScrolledAway) {
              this.terminal?.scrollToBottom()
            }
            // 活跃度跟踪
            appBusiness.addActivity(this.id, data.data.length)
          }
        })
        // 通知后端调整大小
        resizeTerminal(this.id, this.terminal.rows, this.terminal.cols)
      }
    }
  },

  mounted() {
    this.initTerminal()

    // 监听后端 PTY 退出事件
    this.closedUnsubscribe = terminalClosedListener((data) => {
      if (data.session_id === this.id) {
        // 通知父组件处理会话关闭
        this.onClose(this.id)
      }
    })

    window.addEventListener('resize', this.handleResize)
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize)

    if (this.outputUnsubscribe) {
      this.outputUnsubscribe()
      this.outputUnsubscribe = null
    }

    if (this.closedUnsubscribe) {
      this.closedUnsubscribe()
      this.closedUnsubscribe = null
    }

    if (this.terminal) {
      try {
        this.terminal.dispose()
      } catch (e) {
        console.warn('Terminal dispose error:', e)
      }
      this.terminal = null
    }
  },

  methods: {
    initTerminal() {
      if (this.terminal) {
        try {
          this.terminal.dispose()
        } catch (e) {
          console.warn('Terminal dispose error:', e)
        }
        this.terminal = null
      }

      this.terminal = new XTerm({
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          cursorAccent: '#1e1e1e',
          selectionBackground: '#264f78'
        },
        cursorBlink: true,
        cursorStyle: 'block'
      })

      this.fitAddon = new FitAddon()
      this.terminal.loadAddon(this.fitAddon)

      const container = this.$refs.terminalContainer as HTMLElement
      if (container) {
        this.terminal.open(container)
        this.fit()

        this.terminal.onData((data) => {
          writeToTerminal(this.id, data)
        })

        this.terminal.onResize(({ cols, rows }) => {
          resizeTerminal(this.id, rows, cols)
        })

        // 监听滚动事件，检测用户是否向上滚动查看历史
        this.terminal.onScroll(() => {
          if (!this.terminal) return
          const viewport = this.terminal.element?.querySelector('.xterm-viewport') as HTMLElement
          if (viewport) {
            // 如果滚动条不在最底部，说明用户在查看历史
            const isAtBottom = Math.abs(viewport.scrollTop - (viewport.scrollHeight - viewport.clientHeight)) < 5
            this.userScrolledAway = !isAtBottom
          }
        })

        this.outputUnsubscribe = terminalOutputListener((data) => {
          if (data.session_id === this.id) {
            const text = new TextDecoder().decode(new Uint8Array(data.data))
            this.terminal?.write(text)
            // 只有用户没有查看历史时才自动滚动到底部
            if (!this.userScrolledAway) {
              this.terminal?.scrollToBottom()
            }
            // 活跃度跟踪
            appBusiness.addActivity(this.id, data.data.length)
          }
        })

        // 初始调整大小
        resizeTerminal(this.id, this.terminal.rows, this.terminal.cols)
      }
    },

    fit() {
      if (this.terminal && this.fitAddon) {
        try {
          this.fitAddon.fit()
          this.terminal.scrollToBottom()
        } catch (e) {
          console.error('Failed to fit terminal:', e)
        }
      }
    },

    handleResize() {
      if (this.isActive) {
        this.fit()
      }
    },

    handleSplit() {
      this.onSplit(this.id)
    },

    handleClose() {
      this.onClose(this.id)
    }
  }
})
</script>

<style scoped>
.terminal-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.terminal-wrapper.active {
  display: flex;
}

.sub-terminal-bar {
  height: 28px;
  background: #252526;
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 4px;
  border-bottom: 1px solid #3e3e42;
}

.sub-tab {
  height: 22px;
  padding: 0 10px;
  background: #2d2d2d;
  border: none;
  border-radius: 4px;
  color: #858585;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sub-tab:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.sub-tab.active {
  background: #1e1e1e;
  color: #d4d4d4;
}

.sub-tab.dead {
  color: #f48771;
}

.sub-tab.add-sub {
  font-size: 14px;
  font-weight: bold;
}

.dead-indicator {
  color: #f48771;
  font-weight: bold;
}

.terminal-container {
  flex: 1;
  padding: 0;
  background: #1e1e1e;
  overflow: hidden;
  padding-bottom: 50px;
}

.terminal-container :deep(.xterm) {
  height: 100%;
  overflow: hidden;
}

.terminal-container :deep(.xterm-screen) {
  overflow: hidden;
  margin-bottom: -50px;
}

.terminal-container :deep(.xterm-screen canvas) {
  overflow: hidden;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.terminal-container :deep(.xterm-viewport::-webkit-scrollbar) {
  display: none !important;
}

.terminal-container :deep(.xterm-scrollable-element > .scrollbar) {
  display: none !important;
}

.terminal-container :deep(.xterm-scrollable-element > .scrollbar > .scra) {
  display: none !important;
}

.terminal-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.terminal-wrapper:hover .terminal-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  background: #3e3e42;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #4e4e4e;
  color: #d4d4d4;
}

.action-btn.danger:hover {
  background: #5a1d1d;
  color: #f48771;
}
</style>
