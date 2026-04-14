<template>
  <div class="app">
    <WindowControls class="window-controls-bar" />
    <div class="app-body">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }"
        :style="{ width: (sidebarCollapsed ? 40 : localSidebarWidth) + 'px' }">
        <ProjectList :collapsed="sidebarCollapsed" @toggle-collapse="handleToggleSidebar"
          @switch-project="handleSwitchProject" @launch="handleLaunch" @open-editor="handleOpenEditor" />
      </aside>
      <div v-if="!sidebarCollapsed" class="sidebar-resizer" @mousedown="startResize"></div>
      <main v-if="localTabs.length > 0" class="main-content">
        <!-- 项目分组标签栏 -->
        <div class="project-tabs">
          <div v-for="tab in localTabs" :key="tab.projectId" class="project-tab"
            :class="{ active: activeProjectId === tab.projectId }" @click="handleSwitchProject(tab.projectId)">
            {{ tab.projectName }}
            <button v-if="tab.projectId !== 'default'" class="project-tab-close"
              @click.stop="handleCloseProjectTab(tab.projectId)">×</button>
          </div>
        </div>

        <!-- 项目路径显示 -->
        <div class="project-path">
          {{ getProjectPath(activeProjectId) }}
        </div>

        <!-- 项目内容区 - 循环渲染 ProjectContent -->
        <div class="content-area">
          <ProjectContent v-for="tab in localTabs" :key="tab.projectId" :project-tab="tab"
            v-show="activeProjectId === tab.projectId" />
        </div>
      </main>
    </div>

    <Settings v-if="showSettings" @close="handleToggleSettings" />

    <ConfirmDialog v-if="closeConfirmModal" :message="closeConfirmMessage" @confirm="pendingCloseProjectId ? confirmCloseProject() : confirmClose()"
      @cancel="closeConfirmModal = false" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type ProjectTab, type Project } from './store/AppBusiness'
import { eventBus } from './utils/EventBus'
import ProjectList from './components/ProjectList.vue'
import ProjectContent from './components/ProjectContent.vue'
import Settings from './components/Settings.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import WindowControls from './components/WindowControls.vue'

export default defineComponent({
  name: 'App',
  components: {
    ProjectList,
    ProjectContent,
    Settings,
    ConfirmDialog,
    WindowControls
  },

  data() {
    return {
      // 本地状态副本
      localTabs: [] as ProjectTab[],
      activeProjectId: 'default',
      sidebarCollapsed: false,
      localSidebarWidth: 260,
      showSettings: false,
      projects: [] as Project[],
      // 弹窗状态
      closeConfirmModal: false,
      closeConfirmMessage: '',
      closeSessionId: '',
      pendingCloseProjectId: '' as string | null
    }
  },

  mounted() {
    // 初始化数据
    appBusiness.initialize()

    // 订阅事件
    eventBus.on(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.on(AppEvents.ACTIVE_PROJECT_CHANGE, this.handleActiveProjectChange)
    eventBus.on(AppEvents.SETTINGS_CHANGE, this.handleSettingsChange)
    eventBus.on(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.on(AppEvents.INITIALIZED, this.handleInitialized)

    // 初始化本地数据
    this.localTabs = [...appBusiness.tabs]
    this.activeProjectId = appBusiness.activeProjectId
    this.sidebarCollapsed = appBusiness.sidebarCollapsed
    this.localSidebarWidth = appBusiness.sidebarWidth
    this.showSettings = appBusiness.showSettings
    this.projects = [...appBusiness.projects]

    // 快捷键
    window.addEventListener('keydown', this.handleKeyDown)
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown)
    eventBus.off(AppEvents.TABS_CHANGE, this.handleTabsChange)
    eventBus.off(AppEvents.ACTIVE_PROJECT_CHANGE, this.handleActiveProjectChange)
    eventBus.off(AppEvents.SETTINGS_CHANGE, this.handleSettingsChange)
    eventBus.off(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.off(AppEvents.INITIALIZED, this.handleInitialized)
  },

  methods: {
    // 事件处理
    handleTabsChange(tabs: ProjectTab[]) {
      this.localTabs = [...tabs]
    },
    handleActiveProjectChange(projectId: string) {
      this.activeProjectId = projectId
    },
    handleSettingsChange(data: { sidebarCollapsed: boolean; sidebarWidth: number; showSettings: boolean; editorPath: string }) {
      this.sidebarCollapsed = data.sidebarCollapsed
      this.showSettings = data.showSettings
      if (data.sidebarWidth) {
        this.localSidebarWidth = data.sidebarWidth
        appBusiness.sidebarWidth = data.sidebarWidth
      }
    },
    handleProjectsChange(projects: Project[]) {
      this.projects = [...projects]
    },
    handleInitialized(data: { projects: Project[]; homeDir: string; editorPath: string }) {
      this.projects = [...data.projects]
    },

    // 业务方法
    async handleLaunch(project: { id: string; name: string; path: string }) {
      await appBusiness.launchTerminal(project.id, project.name, project.path)
    },

    handleOpenEditor({ projectId, projectName, path, content }: { projectId: string | null; projectName: string | null; path: string; content: string }) {
      appBusiness.openEditor(projectId, projectName, path, content)
    },

    handleSwitchProject(projectId: string) {
      appBusiness.switchProjectTab(projectId)
    },

    handleCloseProjectTab(projectId: string) {
      const tab = this.localTabs.find(t => t.projectId === projectId)
      if (tab) {
        this.pendingCloseProjectId = projectId
        this.closeConfirmMessage = `确定要关闭项目 "${tab.projectName}" 吗？`
        this.closeConfirmModal = true
      }
    },

    confirmCloseProject() {
      if (this.pendingCloseProjectId) {
        appBusiness.closeProjectTab(this.pendingCloseProjectId)
      }
      this.closeConfirmModal = false
      this.pendingCloseProjectId = null
    },

    handleToggleSidebar() {
      appBusiness.toggleSidebar()
    },

    handleToggleSettings() {
      appBusiness.toggleSettings()
    },

    getProjectPath(projectId: string): string {
      const project = this.projects.find(p => p.id === projectId)
      return project?.path || ''
    },

    handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        const addBtn = document.querySelector('.btn-add') as HTMLButtonElement
        addBtn?.click()
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        appBusiness.toggleSidebar()
      }
    },

    startResize(e: MouseEvent) {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = this.localSidebarWidth

      const doResize = (e: MouseEvent) => {
        const delta = e.clientX - startX
        const newWidth = Math.max(180, Math.min(500, startWidth + delta))
        this.localSidebarWidth = newWidth
        appBusiness.setSidebarWidth(newWidth)
      }

      const stopResize = () => {
        document.removeEventListener('mousemove', doResize)
        document.removeEventListener('mouseup', stopResize)
      }

      document.addEventListener('mousemove', doResize)
      document.addEventListener('mouseup', stopResize)
    }
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  overflow: hidden;
}

.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding-top: 38px;
}

.sidebar {
  min-width: 180px;
  max-width: 500px;
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
  transition: width 0.2s;
}

.sidebar.collapsed {
  width: 40px !important;
  min-width: 40px;
}

.sidebar-resizer {
  width: 4px;
  height: 100%;
  flex-shrink: 0;
  background: transparent;
  cursor: col-resize;
  transition: background 0.2s;
}

.sidebar-resizer:hover {
  background: #007acc;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  overflow: hidden;
}

.project-tabs {
  height: 36px;
  background: #252526;
  display: flex;
  align-items: center;
  overflow-x: auto;
  border-bottom: 1px solid #3e3e42;
}

.project-tabs::-webkit-scrollbar {
  height: 4px;
}

.project-tabs::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 2px;
}

.project-tab {
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

.project-tab:hover {
  background: #323232;
  color: #d4d4d4;
}

.project-tab.active {
  background: #1e1e1e;
  color: #d4d4d4;
  border-bottom: 2px solid #007acc;
}

.project-tab-close {
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-tab-close:hover {
  background: #3e3e42;
  color: #fff;
}

.project-path {
  height: 24px;
  padding: 0 12px;
  background: #252526;
  color: #858585;
  font-size: 12px;
  display: flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
