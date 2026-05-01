<template>
  <div class="activity-bar">
    <!-- 文件浏览器 -->
    <div class="activity-icon" :class="{ active: activePanel === 'explorer' }" @click="togglePanel('explorer')" title="文件浏览器">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 7c0-1.1.9-2 2-2h3l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
    </div>

    <!-- 终端 -->
    <div class="activity-icon terminal-icon" :class="{ active: activePanel === 'terminal' }" @click="togglePanel('terminal')" title="终端">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8l4 4-4 4" />
        <path d="M12 16h6" />
      </svg>
      <!-- 状态指示器 -->
      <div class="terminal-status-indicator" v-if="hasActiveSessions">
        <div
          v-for="(status, idx) in sessionStatuses"
          :key="idx"
          class="status-dot"
          :class="status"
        />
      </div>
    </div>

    <!-- 搜索 -->
    <div class="activity-icon" :class="{ active: activePanel === 'search' }" @click="togglePanel('search')" title="搜索">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    </div>

    <!-- Kill Port -->
    <div class="activity-icon" :class="{ active: activePanel === 'killport' }" @click="togglePanel('killport')" title="Kill Port">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    </div>

    <!-- 设置 -->
    <div class="activity-icon" :class="{ active: activePanel === 'settings' }" @click="togglePanel('settings')" title="设置">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </div>

    <!-- 底部折叠按钮 -->
    <div class="activity-spacer"></div>
    <div class="activity-icon" @click="handleToggleSidebar" title="切换侧边栏">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type TerminalSession } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'

export type ActivityPanel = 'explorer' | 'terminal' | 'search' | 'killport' | 'settings'

export default defineComponent({
  name: 'ActivityBar',

  emits: ['toggle-sidebar', 'panel-change'],

  data() {
    return {
      activePanel: 'explorer' as ActivityPanel,
      sessions: [] as TerminalSession[],
      waitingMap: {} as Record<string, string>,
      failedMap: {} as Record<string, number>
    }
  },

  computed: {
    hasActiveSessions(): boolean {
      return this.sessions.some(s => s.alive || this.waitingMap[s.id] || this.failedMap[s.id])
    },
    sessionStatuses(): string[] {
      return this.sessions.slice(0, 3).map(s => {
        if (this.waitingMap[s.id]) return 'waiting'
        if (this.failedMap[s.id]) return 'failed'
        if (!s.alive) return 'dead'
        return 'alive'
      })
    }
  },

  mounted() {
    eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.on(AppEvents.SESSION_WAITING, this.handleSessionWaiting)
    eventBus.on(AppEvents.SESSION_FAILED, this.handleSessionFailed)
    this.sessions = [...appBusiness.sessions]
  },

  beforeUnmount() {
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.SESSION_WAITING, this.handleSessionWaiting)
    eventBus.off(AppEvents.SESSION_FAILED, this.handleSessionFailed)
  },

  methods: {
    handleSessionsChange(sessions: TerminalSession[]) {
      this.sessions = [...sessions]
    },
    handleSessionWaiting(sessionId: string, reason: string) {
      this.waitingMap[sessionId] = reason
    },
    handleSessionFailed(sessionId: string, exitCode: number) {
      this.failedMap[sessionId] = exitCode
    },
    togglePanel(panel: ActivityPanel) {
      if (this.activePanel === panel) {
        this.activePanel = 'explorer'
        this.$emit('panel-change', null)
      } else {
        this.activePanel = panel
        this.$emit('panel-change', panel)
      }
    },

    handleToggleSidebar() {
      this.$emit('toggle-sidebar')
    }
  }
})
</script>

<style scoped>
.activity-bar {
  width: 48px;
  background: #333333;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
  flex-shrink: 0;
}

.activity-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #858585;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  position: relative;
}

.activity-icon:hover {
  color: #d4d4d4;
  background: rgba(255, 255, 255, 0.05);
}

.activity-icon.active {
  color: #ffffff;
}

.activity-icon.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #007acc;
}

.terminal-status-indicator {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
}

.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #6a6a6a;
}

.status-dot.alive {
  background: #4ec9b0;
}

.status-dot.waiting {
  background: #e67700;
  animation: pulse-dot 1.5s infinite;
}

.status-dot.failed {
  background: #c0392b;
}

.status-dot.dead {
  background: #6a6a6a;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.activity-spacer {
  flex: 1;
}
</style>
