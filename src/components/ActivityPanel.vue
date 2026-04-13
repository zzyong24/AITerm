<template>
  <div class="activity-panel">
    <div class="activity-title">实时状态</div>
    <div
      v-for="session in sessions"
      :key="session.id"
      class="activity-row"
    >
      <div class="activity-name">{{ session.projectName || '终端' }}</div>
      <div class="activity-bar-container">
        <div class="activity-bar-bg">
          <div
            class="activity-bar"
            :class="{ 'bar-dead': !session.alive }"
            :style="{ width: getActivityWidth(session.id) + '%' }"
          />
        </div>
        <span class="activity-bytes">{{ getActivityBytes(session.id) }}B</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'

export default defineComponent({
  name: 'ActivityPanel',

  data() {
    return {
      sessions: [] as any[],
      activityData: {} as Record<string, { last: number; bytes: number }>,
      tick: 0,
      tickTimer: null as ReturnType<typeof setInterval> | null,
      // 记录每个项目的第一个 sessionId
      firstSessionMap: {} as Record<string, string>
    }
  },

  mounted() {
    // 订阅事件
    eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.on(AppEvents.ACTIVITY_CHANGE, this.handleActivityChange)

    // 初始化数据
    this.sessions = [...appBusiness.sessions]
    this.activityData = { ...appBusiness.activityData }

    // 定时刷新
    this.tickTimer = setInterval(() => {
      this.tick++
    }, 1000)
  },

  beforeUnmount() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.ACTIVITY_CHANGE, this.handleActivityChange)
  },

  methods: {
    handleSessionsChange(sessions: any[]) {
      // 只记录每个项目的第一个终端
      const newFirstSessionMap: Record<string, string> = {}
      const filteredSessions: any[] = []

      for (const session of sessions) {
        const projectId = session.projectId || 'default'
        if (!newFirstSessionMap[projectId]) {
          newFirstSessionMap[projectId] = session.id
          filteredSessions.push(session)
        }
      }

      this.firstSessionMap = newFirstSessionMap
      this.sessions = filteredSessions
    },
    handleActivityChange(sessionId: string, data: { last: number; bytes: number }) {
      this.activityData[sessionId] = data
    },

    getActivityWidth(sessionId: string): number {
      const act = this.activityData[sessionId]
      if (!act) return 0

      const age = Date.now() - act.last
      if (age > 5000) return 0

      return Math.min(act.bytes / 5, 100)
    },

    getActivityBytes(sessionId: string): number {
      const act = this.activityData[sessionId]
      if (!act) return 0

      const age = Date.now() - act.last
      if (age > 5000) return 0

      return act.bytes
    }
  }
})
</script>

<style scoped>
.activity-panel {
  border-top: 1px solid #3e3e42;
  padding: 8px 12px;
}

.activity-title {
  font-size: 11px;
  color: #858585;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.activity-row {
  margin-bottom: 6px;
}

.activity-name {
  font-size: 12px;
  color: #d4d4d4;
  margin-bottom: 2px;
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

.activity-bytes {
  font-size: 10px;
  color: #858585;
  min-width: 40px;
  text-align: right;
}
</style>
