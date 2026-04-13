<template>
  <div class="project-list" :class="{ collapsed: collapsed }">
    <template v-if="!collapsed">
      <!-- 标签栏 -->
      <div class="panel-tabs">
        <button class="panel-tab" :class="{ active: activeTab === 'explorer' }" @click="activeTab = 'explorer'"
          title="资源管理器">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
          </svg>
        </button>
        <button class="panel-tab" :class="{ active: activeTab === 'search' }" @click="activeTab = 'search'" title="搜索">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button class="panel-tab" :class="{ active: activeTab === 'git' }" @click="activeTab = 'git'" title="源代码管理">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M6 9v12" />
          </svg>
          <span v-if="totalGitChanges > 0" class="git-badge">{{ Math.min(totalGitChanges, 99) }}</span>
        </button>
        <div class="panel-tabs-spacer"></div>
        <button class="btn-settings" @click="handleToggleSettings" title="设置">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
            </path>
          </svg>
        </button>
      </div>

      <!-- 资源管理器面板 -->
      <div v-show="activeTab === 'explorer'" class="panel-content">
        <div class="explorer-header">
          <span class="explorer-title">项目</span>
          <button class="btn-add" @click="openAddModal" title="添加项目 [Ctrl+N]">+</button>
        </div>
        <div class="project-items">
          <template v-for="(items, group) in grouped" :key="group">
            <div v-if="items && items.length > 0" class="project-group">
              <div v-if="group" class="group-header">{{ group }}</div>
              <div v-for="project in items" :key="project ? project.id : 0" class="project-item"
                :class="{ active: isProjectActive(project.id) }" :data-project-id="project.id"
                @click="handleSelectProject(project.id)" @mouseenter="showPathTooltip($event, project)"
                @mouseleave="hidePathTooltip">
                <template v-if="editingId === project.id">
                  <input v-model="editName" class="edit-name-input" @blur="handleRename(project.id)"
                    @keydown.enter="handleRename(project.id)" @keydown.escape="editingId = null" @click.stop autofocus />
                </template>
                <template v-else>
                  <div class="project-name" @click.stop="toggleExpand(project.id)"
                    @contextmenu.prevent="(e) => showContextMenu(e, project, 'project')">
                    <span class="expand-toggle">{{ expandedId === project.id ? '▼' : '▶' }}</span>
                    {{ project.name }}
                    <span v-if="getGitStatus(project.path)" class="git-icon-wrapper">
                      <svg class="git-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                        <path d="M6 9v12" />
                      </svg>
                      <span v-if="getGitChangesCount(project.path) > 0" class="git-badge-small">
                        {{ getGitChangesCount(project.path) }}
                      </span>
                    </span>
                  </div>
                </template>
                <!-- 目录树 -->
                <div v-if="expandedId === project.id" class="project-tree-container">
                  <DirectoryTree :root-path="project.path" @node-click="handleTreeNodeClick"
                    @open-editor="handleOpenEditor" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 搜索面板 -->
      <div v-show="activeTab === 'search'" class="panel-content">
        <div class="search-header">
          <span class="search-title">搜索</span>
          <button class="btn-search-options" @click="showSearchOptions = !showSearchOptions" title="搜索选项">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
        <div class="search-input-container">
          <div class="search-row">
            <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索文件内容..."
              @keydown.enter="handleSearch" />
            <button class="btn-search" @click="handleSearch" title="搜索">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
          <div class="search-row">
            <span class="search-label">目录:</span>
            <span class="search-path">{{ searchPath || '全部项目' }}</span>
            <button class="btn-small" @click="showPathPicker = !showPathPicker">选择</button>
            <div v-if="showPathPicker" class="path-picker">
              <div class="path-picker-item" @click="selectSearchPath('')">全部项目</div>
              <div v-for="project in projects" :key="project.id" class="path-picker-item"
                @click="selectSearchPath(project.path)">
                {{ project.name }}
              </div>
            </div>
          </div>
          <div v-if="showSearchOptions" class="search-options">
            <label class="search-option">
              <input type="checkbox" v-model="searchOptions.caseSensitive" />
              区分大小写
            </label>
            <label class="search-option">
              <input type="checkbox" v-model="searchOptions.wholeWord" />
              全字匹配
            </label>
            <label class="search-option">
              <input type="checkbox" v-model="searchOptions.regex" />
              使用正则
            </label>
          </div>
        </div>
        <div class="search-results">
          <div v-if="searching" class="search-empty">
            搜索中...
          </div>
          <div v-else-if="searchQuery && searchResults.length === 0" class="search-empty">
            未找到匹配结果
          </div>
          <div v-for="(results, file) in groupedResults" :key="file" class="search-file-group">
            <div class="search-file-header" @click="toggleFileExpand(file)">
              <span class="expand-icon">{{ expandedFiles.includes(file) ? '▼' : '▶' }}</span>
              <span class="search-result-file">{{ file }}</span>
              <span class="search-result-count">{{ results.length }} 个匹配</span>
            </div>
            <div v-if="expandedFiles.includes(file)" class="search-file-matches">
              <div v-for="(result, idx) in results" :key="idx" class="search-match-item"
                @click="handleSearchResultClick(result)">
                <span class="match-line">{{ result.line }}</span>
                <span class="match-preview">{{ getMatchPreview(result) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Git 面板 -->
      <div v-show="activeTab === 'git'" class="panel-content">
        <div class="git-header">
          <span class="git-title">源代码管理</span>
        </div>
        <div class="git-projects">
          <div v-if="gitProjects.length === 0" class="git-empty">
            没有 Git 项目
          </div>
          <div v-for="project in gitProjects" :key="project.id" class="git-project-item"
            @contextmenu.prevent="showContextMenu($event, project, 'git')">
            <div class="git-project-info">
              <span class="git-branch">{{ project.gitStatus?.branch || 'master' }}</span>
              <span class="git-project-name">{{ project.name }}</span>
            </div>
            <div v-if="project.gitStatus" class="git-changes">
              <span v-if="project.gitStatus.modified?.length" class="git-change modified">
                {{ project.gitStatus.modified.length }} 个文件已修改
              </span>
              <span v-if="project.gitStatus.untracked?.length" class="git-change untracked">
                {{ project.gitStatus.untracked.length }} 个未跟踪文件
              </span>
              <span v-if="project.gitStatus.staged?.length" class="git-change staged">
                {{ project.gitStatus.staged.length }} 个文件已暂存
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 活跃度面板 -->
      <ActivityPanel v-if="sessions.length > 0" />

      <!-- 右键菜单 -->
      <div v-if="contextMenu.visible" class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
        <template v-if="contextMenu.type === 'project'">
          <div class="context-menu-item" @click="handleLaunchTerminal">创建终端</div>
          <div class="context-menu-item" @click="handleSearchInDirectory">在目录中搜索</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleOpenInEditor">编辑器打开</div>
          <div class="context-menu-item" @click="startRename">重命名</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item danger" @click="handleRemoveProject">移除项目</div>
        </template>
        <template v-else-if="contextMenu.type === 'file'">
          <div class="context-menu-item" @click="handleOpenFile">打开</div>
          <div class="context-menu-item" @click="handleEditFile">编辑</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleCopyPath">复制路径</div>
          <div class="context-menu-item" @click="handleCopyFile">复制</div>
          <div class="context-menu-item" @click="handleCutFile">剪切</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item danger" @click="handleDeleteFile">删除</div>
        </template>
        <template v-else-if="contextMenu.type === 'directory'">
          <div class="context-menu-item" @click="handleOpenInNewTerminal">在此目录中打开终端</div>
          <div class="context-menu-item" @click="handleSearchInDirectory">在目录中搜索</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleCopyPath">复制路径</div>
          <div class="context-menu-item" @click="handlePasteFile">粘贴</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item danger" @click="handleDeleteDirectory">删除</div>
        </template>
        <template v-else-if="contextMenu.type === 'git'">
          <div class="context-menu-item" @click="handleGitStageAll">暂存所有更改</div>
          <div class="context-menu-item" @click="handleGitCommit">提交...</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleGitPush">推送到远程</div>
          <div class="context-menu-item" @click="handleGitPull">从远程拉取</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleRefreshGitStatus">刷新状态</div>
        </template>
      </div>

      <!-- 浮动路径提示 -->
      <div v-if="hoveredProject" class="path-tooltip"
        :style="{ left: hoveredProject.x + 'px', top: hoveredProject.y + 'px' }">
        {{ hoveredProject.path }}
      </div>
    </template>

    <!-- 添加项目弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click="showModal = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <span>添加项目</span>
          <button class="modal-close" @click="showModal = false">×</button>
        </div>
        <div class="modal-body">
          <label>
            项目名称
            <input v-model="newName" type="text" placeholder="例如: 我的项目" @keydown.enter="handleAdd" autofocus />
          </label>
          <label>
            路径
            <div class="path-input-row">
              <input v-model="newPath" type="text" placeholder="/path/to/project" />
              <button @click="handleBrowse">浏览</button>
            </div>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-confirm" @click="handleAdd" :disabled="!newName.trim() || !newPath.trim()">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type Project } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import {
  pickDirectory as apiPickDirectory,
  getGitStatus as apiGetGitStatus,
  readFile as apiReadFile,
  searchInDirectory as apiSearchInDirectory,
  searchFileContent as apiSearchFileContent,
  openProjectInEditor as apiOpenProjectInEditor,
  execCommand as apiExecCommand,
  type GitStatus
} from '../api'
import { alert, confirm, prompt } from '../plugins/MessageBox'
import DirectoryTree from './DirectoryTree.vue'
import ActivityPanel from './ActivityPanel.vue'

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  project: Project | null
  type: 'project' | 'file' | 'directory' | 'git'
  path: string
}

interface GitStatusMap {
  [key: string]: GitStatus | null
}

export default defineComponent({
  name: 'ProjectList',

  components: {
    DirectoryTree,
    ActivityPanel
  },

  props: {
    collapsed: {
      type: Boolean,
      default: false
    }
  },

  emits: ['toggle-collapse', 'launch', 'switch-project', 'open-editor', 'context-menu'],

  data() {
    return {
      // 本地状态
      projects: [] as Project[],
      sessions: [] as any[],
      activeProjectId: 'default',
      // UI 状态
      showModal: false,
      newName: '',
      newPath: '',
      editingId: null as string | null,
      editName: '',
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        project: null,
        type: 'project' as 'project' | 'file' | 'directory',
        path: ''
      } as ContextMenuState,
      expandedId: null as string | null,
      hoveredProject: null as { path: string; x: number; y: number } | null,
      gitStatusMap: {} as GitStatusMap,
      activeTab: 'explorer' as 'explorer' | 'search' | 'git',
      searchQuery: '',
      searchResults: [] as { file: string; path: string; line: number; preview: string }[],
      searchPath: '',
      showSearchOptions: false,
      showPathPicker: false,
      searching: false,
      expandedFiles: [] as string[],
      searchOptions: {
        caseSensitive: false,
        wholeWord: false,
        regex: false
      }
    }
  },

  computed: {
    grouped(): Record<string, Project[]> {
      if (!this.projects || !Array.isArray(this.projects)) {
        return {}
      }
      return this.projects.reduce<Record<string, Project[]>>((acc, p) => {
        if (!p) return acc
        const group = p.group || ''
        if (!acc[group]) acc[group] = []
        acc[group].push(p)
        return acc
      }, {})
    },

    gitProjects(): (Project & { gitStatus: GitStatus | null })[] {
      return this.projects
        .filter(p => p && this.gitStatusMap[p.id]?.isRepo)
        .map(p => ({
          ...p,
          gitStatus: this.gitStatusMap[p.id] || null
        }))
    },

    totalGitChanges(): number {
      let total = 0
      for (const project of this.gitProjects) {
        if (project.gitStatus) {
          total += (project.gitStatus.modified?.length || 0)
          total += (project.gitStatus.untracked?.length || 0)
          total += (project.gitStatus.staged?.length || 0)
        }
      }
      return total
    },

    groupedResults(): Record<string, { file: string; path: string; line: number; preview: string }[]> {
      const grouped: Record<string, { file: string; path: string; line: number; preview: string }[]> = {}
      for (const result of this.searchResults) {
        if (!grouped[result.file]) {
          grouped[result.file] = []
        }
        grouped[result.file].push(result)
      }
      return grouped
    }
  },

  mounted() {
    // 订阅事件
    eventBus.on(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.on(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.on(AppEvents.ACTIVE_PROJECT_CHANGE, this.handleActiveProjectChange)
    eventBus.on(AppEvents.INITIALIZED, this.handleInitialized)

    // 初始化本地数据
    this.projects = [...appBusiness.projects]
    this.sessions = [...appBusiness.sessions]
    this.activeProjectId = appBusiness.activeProjectId

    // 加载 Git 状态
    this.projects.forEach((p) => {
      if (p.id && !this.gitStatusMap[p.id]) {
        this.loadGitStatus(p)
      }
    })

    window.addEventListener('click', this.closeContextMenu)
  },

  beforeUnmount() {
    window.removeEventListener('click', this.closeContextMenu)
    eventBus.off(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.ACTIVE_PROJECT_CHANGE, this.handleActiveProjectChange)
    eventBus.off(AppEvents.INITIALIZED, this.handleInitialized)
  },

  methods: {
    // 事件处理
    handleProjectsChange(projects: Project[]) {
      this.projects = [...projects]
      // 加载新项目的 Git 状态
      projects.forEach((p) => {
        if (p.id && !this.gitStatusMap[p.id]) {
          this.loadGitStatus(p)
        }
      })
    },
    handleSessionsChange(sessions: any[]) {
      this.sessions = [...sessions]
    },
    handleActiveProjectChange(projectId: string) {
      this.activeProjectId = projectId
    },

    handleInitialized(data: { projects: Project[]; homeDir: string; editorPath: string }) {
      this.projects = [...data.projects]
      // 加载 Git 状态
      data.projects.forEach((p) => {
        if (p.id && !this.gitStatusMap[p.id]) {
          this.loadGitStatus(p)
        }
      })
    },

    handleToggleSettings() {
      appBusiness.toggleSettings()
    },

    isProjectActive(projectId: string): boolean {
      return this.activeProjectId === projectId
    },

    handleSelectProject(projectId: string) {
      this.$emit('switch-project', projectId)
    },

    openAddModal() {
      this.newName = ''
      this.newPath = ''
      this.showModal = true
    },

    handleOpenEditor(data: { projectId: string | null; projectName: string | null; path: string; content: string }) {
      this.$emit('open-editor', data)
    },

    async handleAdd() {
      if (this.newName.trim() && this.newPath.trim()) {
        await appBusiness.addProject(this.newName.trim(), this.newPath.trim())
        this.showModal = false
      }
    },

    async handleBrowse() {
      let selected = await apiPickDirectory()
      if (!selected) {
        const path = await prompt('请输入项目路径:', '')
        if (path && path.trim()) {
          selected = path.trim()
        }
      }
      if (selected) {
        const name = selected.split('/').filter(Boolean).pop() || selected
        this.newPath = selected
        this.newName = name
      }
    },

    async handleRemoveProject() {
      if (this.contextMenu.project) {
        const confirmed = await confirm(`确定要从列表中移除项目 "${this.contextMenu.project.name}" 吗？此操作不会删除任何文件。`)
        if (confirmed) {
          await appBusiness.removeProject(this.contextMenu.project.id)
        }
      }
      this.closeContextMenu()
    },

    async handleGitStageAll() {
      if (!this.contextMenu.project) return
      try {
        const result = await apiExecCommand('git add -A', this.contextMenu.project.path)
        if (result.success) {
          await this.loadGitStatus(this.contextMenu.project)
          alert('已暂存所有更改')
        } else {
          alert(result.error || '暂存失败')
        }
      } catch (e) {
        alert(`暂存失败: ${e}`)
      }
      this.closeContextMenu()
    },

    async handleGitCommit() {
      if (!this.contextMenu.project) return
      const message = await prompt('请输入提交信息:')
      if (!message) return
      try {
        const result = await apiExecCommand(`git commit -m "${message}"`, this.contextMenu.project.path)
        if (result.success) {
          await this.loadGitStatus(this.contextMenu.project)
          alert('提交成功')
        } else {
          alert(result.error || '提交失败')
        }
      } catch (e) {
        alert(`提交失败: ${e}`)
      }
      this.closeContextMenu()
    },

    async handleGitPush() {
      if (!this.contextMenu.project) return
      try {
        const result = await apiExecCommand('git push', this.contextMenu.project.path)
        if (result.success) {
          await this.loadGitStatus(this.contextMenu.project)
          alert('推送成功')
        } else {
          alert(result.error || '推送失败')
        }
      } catch (e) {
        alert(`推送失败: ${e}`)
      }
      this.closeContextMenu()
    },

    async handleGitPull() {
      if (!this.contextMenu.project) return
      try {
        const result = await apiExecCommand('git pull', this.contextMenu.project.path)
        if (result.success) {
          await this.loadGitStatus(this.contextMenu.project)
          alert('拉取成功')
        } else {
          alert(result.error || '拉取失败')
        }
      } catch (e) {
        alert(`拉取失败: ${e}`)
      }
      this.closeContextMenu()
    },

    async handleRefreshGitStatus() {
      if (!this.contextMenu.project) return
      await this.loadGitStatus(this.contextMenu.project)
      this.closeContextMenu()
    },

    async handleOpenInEditor() {
      if (this.contextMenu.project) {
        try {
          await apiOpenProjectInEditor(this.contextMenu.project.path)
        } catch (e) {
          alert(`打开编辑器失败: ${e}`)
        }
      }
      this.closeContextMenu()
    },

    handleLaunchTerminal() {
      if (this.contextMenu.project) {
        this.$emit('launch', this.contextMenu.project)
      }
      this.closeContextMenu()
    },

    startRename() {
      if (this.contextMenu.project) {
        this.editingId = this.contextMenu.project.id
        this.editName = this.contextMenu.project.name
      }
      this.closeContextMenu()
    },

    async handleRename(id: string) {
      if (this.editName.trim()) {
        await appBusiness.renameProject(id, this.editName.trim())
      }
      this.editingId = null
    },

    toggleExpand(projectId: string) {
      if (this.expandedId === projectId) {
        this.expandedId = null
      } else {
        this.expandedId = projectId
      }
    },

    showContextMenu(e: MouseEvent, project: Project | null, type: 'project' | 'file' | 'directory' = 'project', path: string = '') {
      this.contextMenu = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        project,
        type,
        path
      }

      setTimeout(() => {
        const menu = document.querySelector('.context-menu') as HTMLElement
        if (menu) {
          const rect = menu.getBoundingClientRect()
          if (rect.right > window.innerWidth) {
            this.contextMenu.x = window.innerWidth - rect.width - 10
          }
          if (rect.bottom > window.innerHeight) {
            this.contextMenu.y = window.innerHeight - rect.height - 10
          }
        }
      }, 0)
    },

    closeContextMenu() {
      this.contextMenu.visible = false
    },

    showPathTooltip(e: MouseEvent, project: Project) {
      // if (project.id !== '__home__') {
      //   const rect = (e.target as HTMLElement).getBoundingClientRect()
      //   this.hoveredProject = {
      //     path: project.path,
      //     x: rect.right + 10,
      //     y: rect.top
      //   }
      // }
    },

    hidePathTooltip() {
      this.hoveredProject = null
    },

    async loadGitStatus(project: Project) {
      try {
        const status = await apiGetGitStatus(project.path)
        if (status.isRepo) {
          this.gitStatusMap[project.id] = status
        }
      } catch (e) {
        console.error('Failed to load git status:', e)
      }
    },

    getGitStatus(path: string): GitStatus | null {
      const project = this.projects.find((p) => p.path === path)
      if (project) {
        return this.gitStatusMap[project.id] || null
      }
      return null
    },

    getGitChangesCount(path: string): number {
      const status = this.getGitStatus(path)
      if (!status) return 0
      const count = (status.modified?.length || 0) + (status.untracked?.length || 0) + (status.staged?.length || 0)
      return Math.min(count, 99)
    },

    handleTreeNodeClick(path: string) {
      console.log('Node clicked:', path)
    },

    handleSearch() {
      if (!this.searchQuery.trim()) {
        this.searchResults = []
        return
      }

      // 确定搜索路径
      let searchPath = this.searchPath
      if (!searchPath && this.activeProjectId) {
        const project = this.projects.find(p => p.id === this.activeProjectId)
        if (project) {
          searchPath = project.path
        }
      }

      if (!searchPath) {
        this.searchResults = []
        return
      }

      this.searching = true
      this.expandedFiles = []

      // 执行文件内容搜索
      apiSearchFileContent(searchPath, this.searchQuery)
        .then(results => {
          this.searchResults = results.map(r => ({
            ...r,
            preview: ''
          }))
          this.searching = false
          // 默认展开前5个文件
          const files = Object.keys(this.groupedResults).slice(0, 5)
          this.expandedFiles = files
        })
        .catch(e => {
          console.error('Search failed:', e)
          this.searchResults = []
          this.searching = false
        })
    },

    handleSearchResultClick(result: { file: string; path: string; line: number }) {
      // 打开编辑器到对应文件
      const project = this.projects.find(p => result.path.startsWith(p.path))
      if (project) {
        const projectId = project.id
        const projectName = project.name
        apiReadFile(result.path).then(content => {
          this.$emit('open-editor', {
            projectId,
            projectName,
            path: result.path,
            content
          })
        })
      }
    },

    getMatchPreview(result: { file: string; path: string; line: number; preview?: string }): string {
      return result.preview || `第 ${result.line} 行`
    },

    selectSearchPath(path: string) {
      this.searchPath = path
      this.showPathPicker = false
    },

    toggleFileExpand(file: string) {
      const idx = this.expandedFiles.indexOf(file)
      if (idx >= 0) {
        this.expandedFiles.splice(idx, 1)
      } else {
        this.expandedFiles.push(file)
      }
    },

    handleSearchInDirectory() {
      if (this.contextMenu.project) {
        this.activeTab = 'search'
        this.searchPath = this.contextMenu.path || this.contextMenu.project.path
        this.searchQuery = ''
      }
      this.closeContextMenu()
    },

    handleOpenFile() {
      console.log('Open file:', this.contextMenu.path)
      this.closeContextMenu()
    },

    handleEditFile() {
      const filePath = this.contextMenu.path
      console.log('Edit file:', filePath)
      if (!filePath) {
        alert('文件路径无效')
        this.closeContextMenu()
        return
      }
      const project = this.projects.find(p => filePath.startsWith(p.path + '/') || filePath === p.path)
      const projectId = project?.id || null
      const projectName = project?.name || null
      console.log('Project:', project?.name, 'projectId:', projectId)

      if (!projectId) {
        alert('文件不在已添加的项目中')
        this.closeContextMenu()
        return
      }

      this.$emit('switch-project', projectId)

      apiReadFile(filePath).then(content => {
        console.log('File read success, content length:', content.length)
        this.$emit('open-editor', {
          projectId,
          projectName,
          path: filePath,
          content
        })
      }).catch(e => {
        console.error('Read file error:', e)
        alert(`读取文件失败: ${e.message || String(e)}\n路径: ${filePath}`)
      })
      this.closeContextMenu()
    },

    handleCopyPath() {
      navigator.clipboard.writeText(this.contextMenu.path)
      this.closeContextMenu()
    },

    handleCopyFile() {
      console.log('Copy file:', this.contextMenu.path)
      this.closeContextMenu()
    },

    handleCutFile() {
      console.log('Cut file:', this.contextMenu.path)
      this.closeContextMenu()
    },

    handlePasteFile() {
      console.log('Paste to:', this.contextMenu.path)
      this.closeContextMenu()
    },

    async handleDeleteFile() {
      const confirmed = await confirm(`确定要删除文件 "${this.contextMenu.path}" 吗？此操作不可撤销。`)
      if (confirmed) {
        console.log('Delete file:', this.contextMenu.path)
      }
      this.closeContextMenu()
    },

    async handleDeleteDirectory() {
      const confirmed = await confirm(`确定要删除目录 "${this.contextMenu.path}" 及其所有内容吗？此操作不可撤销。`)
      if (confirmed) {
        console.log('Delete directory:', this.contextMenu.path)
      }
      this.closeContextMenu()
    },

    handleOpenInNewTerminal() {
      if (this.contextMenu.project) {
        this.$emit('launch', {
          ...this.contextMenu.project,
          path: this.contextMenu.path
        })
      }
      this.closeContextMenu()
    }
  }
})
</script>

<style scoped>
.project-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.collapsed-tabs {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}

.panel-tabs {
  height: 36px;
  display: flex;
  align-items: center;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  padding: 0 4px;
}

.panel-tab {
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  color: #858585;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.panel-tab:hover {
  color: #d4d4d4;
  background: #3e3e42;
}

.panel-tab.active {
  color: #d4d4d4;
  background: #1e1e1e;
  border-bottom: 2px solid #007acc;
}

.panel-tab {
  position: relative;
}

.git-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: #007acc;
  color: #fff;
  border-radius: 7px;
  font-size: 9px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-tabs-spacer {
  flex: 1;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.explorer-header {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #3e3e42;
}

.explorer-title {
  font-size: 11px;
  font-weight: 600;
  color: #d4d4d4;
  text-transform: uppercase;
}

.search-header,
.git-header {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #3e3e42;
}

.search-title,
.git-title {
  font-size: 11px;
  font-weight: 600;
  color: #d4d4d4;
  text-transform: uppercase;
}

.search-input-container {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.search-label {
  font-size: 12px;
  color: #858585;
  min-width: 40px;
}

.search-path {
  flex: 1;
  font-size: 11px;
  color: #d4d4d4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-input {
  flex: 1;
  padding: 6px 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: #007acc;
}

.btn-search {
  width: 28px;
  height: 28px;
  background: #0e639c;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-search:hover {
  background: #1177bb;
}

.btn-search-options {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-search-options:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.btn-small {
  padding: 2px 8px;
  background: #3e3e42;
  border: none;
  border-radius: 3px;
  color: #d4d4d4;
  font-size: 11px;
  cursor: pointer;
}

.btn-small:hover {
  background: #4e4e4e;
}

.path-picker {
  position: absolute;
  top: 100%;
  left: 40px;
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  min-width: 200px;
}

.path-picker-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
}

.path-picker-item:hover {
  background: #094771;
}

.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px 0;
}

.search-option {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #d4d4d4;
  cursor: pointer;
}

.search-option input {
  cursor: pointer;
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.search-empty,
.git-empty {
  padding: 12px;
  color: #858585;
  font-size: 13px;
  text-align: center;
}

.search-file-group {
  margin-bottom: 4px;
}

.search-file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.search-file-header:hover {
  background: #2a2d2e;
}

.expand-icon {
  width: 12px;
  font-size: 10px;
  color: #858585;
}

.search-result-file {
  color: #d4d4d4;
  font-size: 13px;
  flex: 1;
}

.search-result-count {
  font-size: 11px;
  color: #858585;
}

.search-file-matches {
  margin-left: 18px;
  border-left: 1px solid #3e3e42;
}

.search-match-item {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 2px;
}

.search-match-item:hover {
  background: #2a2d2e;
}

.match-line {
  min-width: 30px;
  color: #858585;
  font-size: 11px;
  text-align: right;
}

.match-preview {
  flex: 1;
  color: #d4d4d4;
  font-size: 12px;
  font-family: 'Menlo', 'Monaco', monospace;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result-item {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.search-result-item:hover {
  background: #2a2d2e;
}

.search-result-file {
  display: block;
  color: #d4d4d4;
  font-size: 13px;
}

.search-result-path {
  display: block;
  color: #858585;
  font-size: 11px;
  margin-top: 2px;
}

.git-projects {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.git-project-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #2d2d2d;
}

.git-project-item:hover {
  background: #2a2d2e;
}

.git-project-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.git-branch {
  padding: 2px 6px;
  background: #3c6e3c;
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
}

.git-project-name {
  color: #d4d4d4;
  font-size: 13px;
}

.git-changes {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.git-change {
  font-size: 11px;
  color: #858585;
}

.git-change.modified {
  color: #f48771;
}

.git-change.untracked {
  color: #8b6914;
}

.git-change.staged {
  color: #4ec9b0;
}

.btn-collapse,
.btn-settings {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-collapse:hover,
.btn-settings:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.btn-settings {
  margin-right: 4px;
}

.btn-add {
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  font-size: 18px;
}

.btn-add:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.project-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.project-items::-webkit-scrollbar {
  width: 8px;
}

.project-items::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

.project-group {
  margin-bottom: 8px;
}

.group-header {
  padding: 4px 12px;
  font-size: 11px;
  color: #858585;
  text-transform: uppercase;
}

.project-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 13px;
}

.project-item.active {
  /* 去掉激活背景色 */
}

.project-name {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.expand-toggle {
  width: 12px;
  font-size: 10px;
  color: #858585;
}

.git-icon {
  color: #858585;
  flex-shrink: 0;
}

.git-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.git-badge-small {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 12px;
  height: 12px;
  padding: 0 2px;
  background: #007acc;
  color: #fff;
  border-radius: 6px;
  font-size: 8px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

.git-indicator {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  background: #3c6e3c;
  color: #fff;
}

.git-indicator.modified {
  background: #8b6914;
}

.git-indicator .git-modified {
  color: #f48771;
}

.edit-name-input {
  width: 100%;
  padding: 2px 4px;
  background: #3c3c3c;
  border: 1px solid #007acc;
  color: #d4d4d4;
  font-size: 13px;
  outline: none;
}

.project-tree-container {
  margin-left: 0;
}

.context-menu {
  position: fixed;
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 99999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #094771;
}

.context-menu-item.danger:hover {
  background: #5a1d1d;
  color: #f48771;
}

.context-menu-separator {
  height: 1px;
  background: #3e3e42;
  margin: 4px 0;
}

.path-tooltip {
  position: fixed;
  background: #3e3e42;
  color: #d4d4d4;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 99999;
  max-width: 400px;
  word-break: break-all;
}

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
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.modal-close {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 20px;
  cursor: pointer;
}

.modal-close:hover {
  color: #d4d4d4;
}

.modal-body {
  padding: 16px;
}

.modal-body label {
  display: block;
  margin-bottom: 12px;
  color: #d4d4d4;
}

.modal-body input {
  width: 100%;
  padding: 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 14px;
  margin-top: 4px;
}

.modal-body input:focus {
  outline: none;
  border-color: #007acc;
}

.path-input-row {
  display: flex;
  gap: 8px;
}

.path-input-row input {
  flex: 1;
}

.path-input-row button {
  padding: 8px 12px;
  background: #0e639c;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.path-input-row button:hover {
  background: #1177bb;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 12px;
  background: #3e3e42;
  border: none;
  border-radius: 4px;
  color: #d4d4d4;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #4e4e4e;
}

.btn-confirm {
  padding: 6px 12px;
  background: #0e639c;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.btn-confirm:hover:not(:disabled) {
  background: #1177bb;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
