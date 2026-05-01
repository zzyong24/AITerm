<template>
  <div class="terminal-panel">
    <div class="panel-header">
      <span>终端</span>
      <button class="btn-add" @click="handleNewTerminal" title="新建终端">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
    <!-- 项目过滤器 -->
    <div class="project-filter" v-if="projects.length > 1">
      <select v-model="selectedProjectId" class="project-select">
        <option value="">全部项目</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>
    <!-- 实时状态详情 -->
    <div class="activity-detail" v-if="sessions.length > 0">
      <div class="activity-row" v-for="session in filteredSessions" :key="session.id">
        <div class="activity-header">
          <div class="activity-name">
            {{ session.projectName || '终端' }}
            <span v-if="waitingMap[session.id]" class="attention-badge waiting" :title="waitingMap[session.id]">需介入</span>
            <span v-else-if="failedMap[session.id]" class="attention-badge failed" :title="'退出码: ' + failedMap[session.id]">失败</span>
          </div>
          <div class="activity-last">{{ getActivityLast(session.id) }}</div>
        </div>
        <div class="activity-bar-container">
          <div class="activity-bar-bg">
            <div class="activity-bar" :class="{ 'bar-dead': !session.alive }" :style="{ width: getActivityWidth(session.id) + '%' }" />
          </div>
          <span class="activity-bytes">{{ getActivityBytes(session.id) }}B</span>
        </div>
      </div>
    </div>
    <div class="panel-body">
      <div v-if="filteredSessions.length === 0" class="empty-state">
        暂无终端
      </div>
      <div v-else class="terminal-list">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="terminal-item"
          :class="{ active: session.id === activeSessionId }"
        >
          <div class="terminal-item-main" @click="handleSelectTerminal(session.id)">
            <div class="terminal-status" :class="{ alive: session.alive }"></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8l4 4-4 4" />
            </svg>
            <input
              v-if="editingSessionId === session.id"
              ref="renameInput"
              v-model="editingName"
              class="terminal-name-input"
              @blur="finishRename(session.id)"
              @keydown.enter="finishRename(session.id)"
              @keydown.escape="cancelRename"
              @click.stop
            />
            <span v-else class="terminal-name" @dblclick.stop="startRename(session)">{{ session.name }}</span>
          </div>
          <div class="terminal-item-info">
            <span class="terminal-cwd">{{ session.workingDir }}</span>
            <div
              v-if="session.alive && activityData[session.id]"
              class="terminal-activity-bar"
              :style="{ width: getActivityWidth(session.id) + '%' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, type TerminalSession, type Project } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import { AppEvents } from '../store/AppBusiness'

export default defineComponent({
  name: 'TerminalPanel',
  emits: ['launch'],
  data() {
    return {
      sessions: [] as TerminalSession[],
      projects: [] as Project[],
      activeSessionId: null as string | null,
      editingSessionId: null as string | null,
      editingName: '',
      renameInput: null as HTMLInputElement | null,
      selectedProjectId: '' as string | null,
      activityData: {} as Record<string, { last: number; bytes: number }>,
      waitingMap: {} as Record<string, string>,
      failedMap: {} as Record<string, number>,
      tick: 0,
      tickTimer: null as ReturnType<typeof setInterval> | null
    }
  },
  computed: {
    filteredSessions(): TerminalSession[] {
      if (!this.selectedProjectId) {
        return this.sessions
      }
      return this.sessions.filter(s => s.projectId === this.selectedProjectId)
    },
    activeSessionCount(): number {
      return this.sessions.filter(s => s.alive).length
    }
  },
  mounted() {
    eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.on(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.on(AppEvents.ACTIVITY_CHANGE, this.handleActivityChange)
    eventBus.on(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.on(AppEvents.SESSION_WAITING, this.handleSessionWaiting)
    eventBus.on(AppEvents.SESSION_FAILED, this.handleSessionFailed)

    this.sessions = [...appBusiness.sessions]
    this.projects = [...appBusiness.projects]
    this.activityData = { ...appBusiness.activityData }
    this.updateActiveSession()

    this.tickTimer = setInterval(() => {
      this.tick++
      this.$forceUpdate()
    }, 1000)
  },
  beforeUnmount() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.off(AppEvents.ACTIVITY_CHANGE, this.handleActivityChange)
    eventBus.off(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.off(AppEvents.SESSION_WAITING, this.handleSessionWaiting)
    eventBus.off(AppEvents.SESSION_FAILED, this.handleSessionFailed)
  },
  methods: {
    handleSessionsChange(sessions: TerminalSession[]) {
      this.sessions = [...sessions]
    },
    handleProjectsChange(projects: Project[]) {
      this.projects = [...projects]
      // 如果当前选中的项目被删了,重置选择
      if (this.selectedProjectId && !projects.find(p => p.id === this.selectedProjectId)) {
        this.selectedProjectId = ''
      }
    },
    handleActivityChange(sessionId: string, data: { last: number; bytes: number }) {
      this.activityData[sessionId] = data
    },
    handleTabsChange() {
      this.updateActiveSession()
    },
    updateActiveSession() {
      const currentTab = appBusiness.currentTab
      if (currentTab) {
        const activeItem = currentTab.items.find(i => i.id === currentTab.activeItemId)
        if (activeItem?.type === 'terminal') {
          this.activeSessionId = activeItem.id
        }
      }
    },
    handleSelectTerminal(sessionId: string) {
      appBusiness.selectItem(sessionId, 'terminal')
      this.activeSessionId = sessionId
    },
    handleNewTerminal() {
      const project = appBusiness.projects[0]
      if (project) {
        this.$emit('launch', { id: project.id, name: project.name, path: project.path })
      }
    },
    startRename(session: TerminalSession) {
      this.editingSessionId = session.id
      this.editingName = session.name
      this.$nextTick(() => {
        const inputs = this.$refs.renameInput as HTMLInputElement[] | HTMLInputElement
        if (Array.isArray(inputs)) {
          const current = inputs.find((_: any, i: number) => this.sessions[i]?.id === session.id)
          current?.focus()
          current?.select()
        } else if (inputs) {
          inputs.focus()
          inputs.select()
        }
      })
    },
    finishRename(sessionId: string) {
      if (this.editingName) {
        const validName = this.editingName.replace(/[^\w\u4e00-\u9fa5\-_]/g, '')
        if (validName) {
          appBusiness.renameSession(sessionId, validName)
        }
      }
      this.editingSessionId = null
      this.editingName = ''
    },
    cancelRename() {
      this.editingSessionId = null
      this.editingName = ''
    },
    isSessionActive(sessionId: string): boolean {
      const act = this.activityData[sessionId]
      if (!act) return false
      return Date.now() - act.last < 5000
    },
    getActivityOpacity(sessionId: string): number {
      const act = this.activityData[sessionId]
      if (!act) return 0.3
      const age = Date.now() - act.last
      if (age > 5000) return 0.2
      if (age > 3000) return 0.5
      return 1
    },
    getActivityWidth(sessionId: string): number {
      const act = this.activityData[sessionId]
      if (!act) return 0
      const age = Date.now() - act.last
      if (age > 5000) return 0
      // Normalize bytes to percentage: 5 bytes = 100% width
      return Math.min(act.bytes / 5, 100)
    },
    getActivityBytes(sessionId: string): number {
      const act = this.activityData[sessionId]
      if (!act) return 0
      const age = Date.now() - act.last
      if (age > 5000) return 0
      return act.bytes
    },
    getActivityLast(sessionId: string): string {
      const act = this.activityData[sessionId]
      if (!act) return ''
      const age = Math.floor((Date.now() - act.last) / 1000)
      if (age < 0) return ''
      if (age < 60) return `${age}秒前`
      if (age < 3600) return `${Math.floor(age / 60)}分钟前`
      if (age < 86400) return `${Math.floor(age / 3600)}小时前`
      return `${Math.floor(age / 86400)}天前`
    },
    handleSessionWaiting(sessionId: string, reason: string) {
      this.waitingMap[sessionId] = reason
    },
    handleSessionFailed(sessionId: string, exitCode: number) {
      this.failedMap[sessionId] = exitCode
    }
  }
})
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #252526;
}

.panel-header {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #858585;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-add {
  background: transparent;
  border: none;
  color: #858585;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-add:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.project-filter {
  padding: 8px 16px;
  border-bottom: 1px solid #3e3e42;
}

.project-select {
  width: 100%;
  background: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.project-select:focus {
  border-color: #007acc;
}

.activity-summary {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e42;
}

.activity-label {
  font-size: 10px;
  color: #858585;
  text-transform: uppercase;
}

.activity-bars {
  flex: 1;
  display: flex;
  gap: 3px;
  overflow: hidden;
}

.activity-mini-bar {
  width: 16px;
  height: 8px;
  background: #4ec9b0;
  border-radius: 2px;
  transition: opacity 0.3s;
}

.activity-mini-bar.inactive {
  background: #6a6a6a;
}

.activity-count {
  font-size: 11px;
  color: #858585;
  min-width: 20px;
  text-align: right;
}

.activity-detail {
  border-bottom: 1px solid #3e3e42;
  padding: 8px 16px;
}

.activity-row {
  margin-bottom: 8px;
}

.activity-row:last-child {
  margin-bottom: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.activity-name {
  font-size: 12px;
  color: #d4d4d4;
}

.activity-last {
  font-size: 10px;
  color: #858585;
}

.activity-bar-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.activity-bar-bg {
  flex: 1;
  height: 4px;
  background: #3e3e42;
  border-radius: 2px;
  overflow: hidden;
}

.activity-bar {
  height: 100%;
  background: #4ec9b0;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.activity-bar.bar-dead {
  background: #f48771;
}

.attention-badge {
  display: inline-block;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  margin-left: 6px;
  font-weight: bold;
  animation: pulse-badge 1.5s infinite;
}

.attention-badge.waiting {
  background: #e67700;
  color: #fff;
}

.attention-badge.failed {
  background: #c0392b;
  color: #fff;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.activity-bytes {
  font-size: 10px;
  color: #858585;
  min-width: 40px;
  text-align: right;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  padding: 16px;
  color: #6a6a6a;
  font-size: 12px;
  text-align: center;
}

.terminal-list {
  display: flex;
  flex-direction: column;
}

.terminal-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 13px;
  transition: background 0.15s;
}

.terminal-item:hover {
  background: #2a2d2e;
}

.terminal-item.active {
  background: #37373d;
}

.terminal-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6a6a6a;
  flex-shrink: 0;
}

.terminal-status.alive {
  background: #4ec9b0;
}

.terminal-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-name-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #007acc;
  border-radius: 3px;
  color: #d4d4d4;
  padding: 2px 6px;
  font-size: 13px;
  outline: none;
}

.terminal-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 22px;
}

.terminal-cwd {
  font-size: 11px;
  color: #6a6a6a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.terminal-activity-bar {
  flex: 1;
  height: 3px;
  background: #4ec9b0;
  border-radius: 2px;
  max-width: 60px;
  transition: width 0.3s ease;
}
</style>