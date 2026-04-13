<template>
  <div class="project-content" v-if="projectTab">
    <!-- 项目内的标签页（终端和编辑器） -->
    <div class="content-tabs">
      <div
        v-for="item in items"
        :key="item.id"
        class="content-tab"
        :class="{ active: item.id === localActiveItemId }"
        @click="handleSelectItem(item)"
      >
        <DesktopOutlined v-if="item.type === 'terminal'" class="tab-icon" />
        <FileTextOutlined v-else class="tab-icon" />
        <span>{{ item.name }}</span>
        <span v-if="item.modified" class="modified-dot">●</span>
        <button
          v-if="item.type === 'terminal'"
          class="tab-close"
          @click.stop="handleCloseTerminal(item.id)"
        >×</button>
        <button
          v-else
          class="tab-close"
          @click.stop="handleCloseEditor(item.id)"
        >×</button>
      </div>
      <div v-if="items.length === 0" class="no-items">
        选择一个项目启动终端或编辑文件
      </div>
    </div>

    <!-- 终端和编辑器内容 -->
    <div class="content-container">
      <template v-for="item in projectTab.items" :key="item.id">
        <Terminal
          v-if="item.type === 'terminal'"
          :session-id="item.id"
          :working-dir="sessions.find(s => s.id === item.id)?.workingDir || '~'"
          :is-active="projectTab.activeItemId === item.id"
          :on-close="handleCloseTerminal"
          :on-split="handleSplit"
          :class="{ inactive: projectTab.activeItemId !== item.id }"
        />
        <CodeEditor
          v-else-if="item.type === 'editor'"
          :editor-id="item.id"
          :is-active="projectTab.activeItemId === item.id"
          :class="{ inactive: projectTab.activeItemId !== item.id }"
        />
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type TabItem, type TerminalSession, type EditorTab, type ProjectTab } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import { DesktopOutlined, FileTextOutlined } from '@ant-design/icons-vue'
import Terminal from './Terminal.vue'
import CodeEditor from './CodeEditor.vue'

export default defineComponent({
  name: 'ProjectContent',

  components: {
    Terminal,
    CodeEditor,
    DesktopOutlined,
    FileTextOutlined
  },

  props: {
    projectTab: {
      type: Object as () => ProjectTab,
      required: true
    }
  },

  data() {
    return {
      // 自己维护的活跃项 ID
      localActiveItemId: null as string | null,
      // 全局数据
      sessions: [] as TerminalSession[],
      editors: [] as EditorTab[]
    }
  },

  computed: {
    items(): TabItem[] {
      return this.projectTab.items.map((item: TabItem) => {
        if (item.type === 'editor') {
          const editor = this.editors.find(e => e.id === item.id)
          return { ...item, modified: editor?.modified || false }
        }
        return item
      })
    },
    activeTerminal(): TerminalSession | null {
      if (!this.localActiveItemId) return null
      const item = this.projectTab.items.find((i: TabItem) => i.id === this.localActiveItemId)
      if (item?.type !== 'terminal') return null
      return this.sessions.find(s => s.id === this.localActiveItemId) || null
    },
    activeEditor(): EditorTab | null {
      if (!this.localActiveItemId) return null
      const item = this.projectTab.items.find((i: TabItem) => i.id === this.localActiveItemId)
      if (item?.type !== 'editor') return null
      return this.editors.find(e => e.id === this.localActiveItemId) || null
    }
  },

  watch: {
    // 当 projectTab 的 activeItemId 变化时同步
    'projectTab.activeItemId': {
      handler(newVal: string | null) {
        this.localActiveItemId = newVal
      }
    }
  },

  mounted() {
    // 初始化
    this.localActiveItemId = this.projectTab.activeItemId

    // 订阅事件
    eventBus.on(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.on(AppEvents.EDITORS_CHANGE, this.handleEditorsChange)

    this.sessions = [...appBusiness.sessions]
    this.editors = [...appBusiness.editors]
  },

  beforeUnmount() {
    eventBus.off(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.EDITORS_CHANGE, this.handleEditorsChange)
  },

  methods: {
    handleSessionsChange(sessions: TerminalSession[]) {
      this.sessions = [...sessions]
    },
    handleEditorsChange(editors: EditorTab[]) {
      this.editors = [...editors]
    },
    handleTabsChange(tabs: ProjectTab[]) {
      // tabs 是全局的，这里不需要处理，由 props 变化触发更新
    },

    handleSelectItem(item: TabItem) {
      this.localActiveItemId = item.id
      appBusiness.selectItem(item.id, item.type)
    },

    handleCloseTerminal(sessionId: string) {
      appBusiness.closeSession(sessionId)
    },

    handleSplit(sessionId: string) {
      // 获取当前 session 的信息
      const session = this.sessions.find(s => s.id === sessionId)
      if (!session) return

      // 以当前终端为模版创建新终端
      appBusiness.launchTerminal(
        session.projectId || 'default',
        session.projectName || '终端',
        session.workingDir
      )
    },

    handleCloseEditor(editorId: string) {
      appBusiness.closeEditor(editorId)
    }
  }
})
</script>

<style scoped>
.project-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.content-tabs {
  height: 36px;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  overflow-x: auto;
  border-bottom: 1px solid #3e3e42;
}

.content-tabs::-webkit-scrollbar {
  height: 4px;
}

.content-tabs::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.content-tab {
  height: 100%;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: #2d2d2d;
  color: #858585;
  border-right: 1px solid #3e3e42;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
}

.content-tab:hover {
  background: #323232;
  color: #d4d4d4;
}

.content-tab.active {
  background: #1e1e1e;
  color: #d4d4d4;
}

.tab-icon {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
}

.modified-dot {
  color: #4ec9b0;
  font-size: 10px;
}

.tab-close {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  opacity: 1;
}

.tab-close:hover {
  background: #3e3e42;
  color: #fff;
}

.content-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.content-container > * {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.content-container > .inactive {
  opacity: 0;
  pointer-events: none;
}

.no-items {
  padding: 0 16px;
  color: #858585;
  font-size: 13px;
}
</style>
