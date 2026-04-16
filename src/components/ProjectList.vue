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
                    <span class="project-name-left">
                      <span class="expand-toggle">{{ expandedId === project.id ? '▼' : '▶' }}</span>
                      {{ project.name }}
                    </span>
                    <span v-if="project.git?.isRepo" class="git-icon-wrapper">
                      <svg class="git-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                        <path d="M6 9v12" />
                      </svg>
                      <span v-if="(project.git?.changesCount || 0) > 0" class="git-badge-small">
                        {{ project.git?.changesCount }}
                      </span>
                    </span>
                  </div>
                </template>
                <!-- 目录树 -->
                <div v-if="expandedId === project.id" class="project-tree-container">
                  <DirectoryTree :root-path="project.path" @node-click="handleTreeNodeClick"
                    @open-editor="handleOpenEditor" @search-in-directory="handleSearchInDirectory"
                    @refresh="handleRefreshDirectory" />
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
        </div>
        <div class="search-input-container">
          <div class="search-row">
            <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索文件内容..." ref="searchInputRef"
              @keydown.enter="handleSearch" @keydown.up.prevent="navigateHistory(-1)"
              @keydown.down.prevent="navigateHistory(1)" @keydown.escape="hideHistoryDropdown"
              @focus="showHistoryDropdown = true" @input="handleSearchInput" />
          </div>
          <!-- 历史搜索下拉 -->
          <div v-if="showHistoryDropdown && searchHistory.length > 0" class="search-history-dropdown">
            <div v-for="(item, idx) in filteredHistory" :key="idx" class="search-history-item"
              :class="{ selected: idx === selectedHistoryIndex }" @click="selectHistoryItem(item)">
              {{ item }}
            </div>
          </div>
          <div class="search-row">
            <input v-model="searchExtensions" type="text" class="search-extensions-input"
              placeholder="扩展名: *.ts,*.js,*.vue 或留空搜索全部" />
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
          <div class="search-options">
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
              正则
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
          <div v-if="hasMoreSearchResults" class="search-warning">
            结果过多，仅显示前 50 个文件。请使用更具体的搜索词缩小范围。
          </div>
          <div v-for="{ file, results } in limitedGroupedResults" :key="file" class="search-file-group">
            <div class="search-file-header" @click="toggleFileExpand(file)">
              <span class="expand-icon">{{ expandedFiles.includes(file) ? '▼' : '▶' }}</span>
              <span class="search-result-file">{{ file }}</span>
              <span class="search-result-count">{{ results.length }} 个匹配</span>
            </div>
            <div v-if="expandedFiles.includes(file)" class="search-file-matches">
              <div v-for="(result, idx) in results" :key="idx" class="search-match-item"
                @click="handleSearchResultClick(result)">
                <span class="match-line">{{ result.line }}</span>
                <span class="match-preview" @mouseenter="showPreviewTooltip($event, result)"
                  @mouseleave="hidePreviewTooltip">
                  {{ getMatchPreview(result) }}
                </span>
              </div>
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
          <div class="context-menu-item" v-if="hasTerminalsToRestore" @click="handleRestoreTerminals">恢复终端</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleSearchInDirectory">在目录中搜索</div>
          <div class="context-menu-separator" />
          <div class="context-menu-item" @click="handleOpenProjectCommitDialog">版本管理</div>
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
      </div>

      <!-- 浮动路径提示 -->
      <div v-if="hoveredProject" class="path-tooltip"
        :style="{ left: hoveredProject.x + 'px', top: hoveredProject.y + 'px' }">
        {{ hoveredProject.path }}
      </div>

      <!-- 浮动 preview 提示 -->
      <div v-if="hoveredPreview" class="preview-tooltip"
        :style="{ left: hoveredPreview.x + 'px', top: hoveredPreview.y + 'px' }">
        {{ hoveredPreview.content }}
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

    <!-- 版本管理弹窗 -->
    <GitCommitDialog v-if="commitDialog.visible" :file-list="commitDialog.files" :loading="commitDialog.loading"
      :branch="commitDialog.branch" :remote="commitDialog.remote" :ahead="commitDialog.ahead"
      :behind="commitDialog.behind" :last-commit="commitDialog.lastCommit" :committing="commitDialog.committing"
      :too-many-files-count="commitDialog.tooManyFilesCount" @commit="handleCommitFiles"
      @cancel="commitDialog.visible = false" @pull="handleDialogPull" @push="handleDialogPush" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type Project } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import {
  pickDirectory as apiPickDirectory,
  getGitStatus as apiGetGitStatus,
  getGitRepoBrief as apiGetGitRepoBrief,
  getGitRemote as apiGetGitRemote,
  getGitLastCommit as apiGetGitLastCommit,
  readFile as apiReadFile,
  searchInDirectory as apiSearchInDirectory,
  searchFileContent as apiSearchFileContent,
  openProjectInEditor as apiOpenProjectInEditor,
  gitStageAll as apiGitStageAll,
  gitStageFile as apiGitStageFile,
  gitUnstageFile as apiGitUnstageFile,
  gitCommit as apiGitCommit,
  gitPush as apiGitPush,
  gitPull as apiGitPull,
  gitDiscardChanges as apiGitDiscardChanges,
  deletePath as apiDeletePath,
  loadTerminals,
  type GitStatus
} from '../api'
import { alert, confirm, prompt } from '../plugins/MessageBox'
import DirectoryTree from './DirectoryTree.vue'
import ActivityPanel from './ActivityPanel.vue'
import GitCommitDialog, { type CommitFile } from './GitCommitDialog.vue'

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  project: Project | null
  type: 'project' | 'file' | 'directory'
  path: string
}

export default defineComponent({
  name: 'ProjectList',

  components: {
    DirectoryTree,
    ActivityPanel,
    GitCommitDialog
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
      hoveredPreview: null as { content: string; x: number; y: number } | null,
      hasTerminalsToRestore: false,
      activeTab: 'explorer' as 'explorer' | 'search',
      searchQuery: '',
      searchResults: [] as { file: string; path: string; line: number; preview: string }[],
      searchPath: '',
      searchExtensions: '',
      showSearchOptions: false,
      showPathPicker: false,
      searching: false,
      expandedFiles: [] as string[],
      searchOptions: {
        caseSensitive: false,
        wholeWord: false,
        regex: false
      },
      searchHistory: [] as string[],
      selectedHistoryIndex: -1,
      showHistoryDropdown: false,
      // 版本管理弹窗
      commitDialog: {
        visible: false,
        loading: false,
        committing: false,
        repoPath: '',
        dirPath: '',
        files: [] as CommitFile[],
        project: null as Project | null,
        branch: '',
        remote: '',
        ahead: 0,
        behind: 0,
        lastCommit: null as { hash: string; date: string; message: string } | null,
        tooManyFilesCount: 0
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

    filteredHistory(): string[] {
      if (!this.searchQuery) {
        // 搜索框为空时，显示所有历史记录
        return this.searchHistory.slice(0, 10)
      }
      const query = this.searchQuery.toLowerCase()
      return this.searchHistory.filter(h => h.toLowerCase().includes(query)).slice(0, 5)
    },

    groupedResults(): Record<string, { file: string; path: string; line: number; preview: string }[]> {
      const grouped: Record<string, { file: string; path: string; line: number; preview: string }[]> = {}
      for (const result of this.searchResults) {
        if (!grouped[result.file]) {
          grouped[result.file] = []
        }
        // 每个文件最多只显示10个结果
        if (grouped[result.file].length < 10) {
          grouped[result.file].push(result)
        }
      }
      return grouped
    },

    limitedGroupedResults(): { file: string; results: { file: string; path: string; line: number; preview: string }[] }[] {
      const entries = Object.entries(this.groupedResults)
      const maxFiles = 50 // 最多显示50个文件
      if (entries.length <= maxFiles) {
        return entries.map(([file, results]) => ({ file, results }))
      }
      return entries.slice(0, maxFiles).map(([file, results]) => ({ file, results }))
    },

    hasMoreSearchResults(): boolean {
      return Object.keys(this.groupedResults).length > 50
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

    window.addEventListener('click', this.closeContextMenu)
    window.addEventListener('click', this.handleOutsideClick)

    // 加载保存的搜索历史
    this.loadSearchHistory()
  },

  beforeUnmount() {
    window.removeEventListener('click', this.closeContextMenu)
    window.removeEventListener('click', this.handleOutsideClick)
    eventBus.off(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.off(AppEvents.SESSIONS_CHANGE, this.handleSessionsChange)
    eventBus.off(AppEvents.ACTIVE_PROJECT_CHANGE, this.handleActiveProjectChange)
    eventBus.off(AppEvents.INITIALIZED, this.handleInitialized)
  },

  methods: {
    // 事件处理
    handleProjectsChange(projects: Project[]) {
      this.projects = [...projects]
    },
    handleSessionsChange(sessions: any[]) {
      this.sessions = [...sessions]
    },
    handleActiveProjectChange(projectId: string) {
      this.activeProjectId = projectId
    },

    handleInitialized(data: { projects: Project[]; homeDir: string; editorPath: string }) {
      this.projects = [...data.projects]
    },

    handleToggleSettings() {
      appBusiness.toggleSettings()
    },

    isProjectActive(projectId: string): boolean {
      return this.activeProjectId === projectId
    },

    handleSelectProject(projectId: string) {
      // 暂时禁用点击切换项目tab的功能
      // this.$emit('switch-project', projectId)
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

    async handleOpenProjectCommitDialog() {
      if (!this.contextMenu.project) return
      this.closeContextMenu()

      const dirPath = this.contextMenu.project.path
      this.commitDialog.loading = true
      this.commitDialog.visible = true
      this.commitDialog.dirPath = dirPath
      this.commitDialog.repoPath = ''
      this.commitDialog.files = []
      this.commitDialog.project = this.contextMenu.project
      this.commitDialog.branch = ''
      this.commitDialog.remote = ''
      this.commitDialog.ahead = 0
      this.commitDialog.behind = 0
      this.commitDialog.lastCommit = null
      this.commitDialog.tooManyFilesCount = 0

      try {
        const brief = await apiGetGitRepoBrief(dirPath)
        if (!brief.isRepo) {
          alert('该目录不是 Git 仓库')
          this.commitDialog.visible = false
          return
        }
        const repoPath = brief.rootPath || dirPath
        this.commitDialog.repoPath = repoPath

        // 文件数量过多，跳过 status 接口，直接显示警告
        if ((brief.changesCount || 0) > 2000) {
          this.commitDialog.tooManyFilesCount = brief.changesCount
          this.commitDialog.loading = false
          return
        }

        const [status, remoteInfo, lastCommit] = await Promise.all([
          apiGetGitStatus(repoPath),
          apiGetGitRemote(repoPath),
          apiGetGitLastCommit(repoPath)
        ])

        this.commitDialog.branch = status.branch
        this.commitDialog.ahead = status.ahead
        this.commitDialog.behind = status.behind
        this.commitDialog.remote = remoteInfo.remoteUrl || remoteInfo.remote
        this.commitDialog.lastCommit = lastCommit.hash ? lastCommit : null

        const files = this.buildCommitFiles(status, dirPath, repoPath)
        this.commitDialog.files = files
      } catch (e) {
        alert(`加载 Git 状态失败: ${e}`)
        this.commitDialog.visible = false
      } finally {
        this.commitDialog.loading = false
      }
    },

    buildCommitFiles(status: GitStatus, dirPath: string, repoPath: string): CommitFile[] {
      const files: CommitFile[] = []
      const dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/'

      const addIfUnderDir = (file: string, badge: string) => {
        const absPath = repoPath.endsWith('/') ? repoPath + file : repoPath + '/' + file
        if (absPath.startsWith(dirPrefix) || absPath === dirPath) {
          files.push({ path: file, name: file, badge })
        }
      }

      status.modified?.forEach(f => addIfUnderDir(f, 'M'))
      status.untracked?.forEach(f => addIfUnderDir(f, 'U'))
      status.deleted?.forEach(f => addIfUnderDir(f, 'D'))
      status.created?.forEach(f => addIfUnderDir(f, 'A'))
      status.renamed?.forEach(f => addIfUnderDir(f, 'R'))
      status.conflicted?.forEach(f => addIfUnderDir(f, 'C'))
      status.staged?.forEach(f => {
        let badge = 'M'
        if (status.deleted?.includes(f)) badge = 'D'
        else if (status.created?.includes(f)) badge = 'A'
        else if (status.renamed?.includes(f)) badge = 'R'
        else if (status.conflicted?.includes(f)) badge = 'C'
        addIfUnderDir(f, badge)
      })

      const seen = new Set<string>()
      return files.filter(f => {
        if (seen.has(f.path)) return false
        seen.add(f.path)
        return true
      })
    },

    async handleCommitFiles({ files, message }: { files: string[]; message: string }) {
      if (!this.commitDialog.repoPath || files.length === 0) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitCommit(this.commitDialog.repoPath, message, files)
        if (result.success) {
          alert('提交成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '提交失败')
        }
      } catch (e) {
        alert(`提交失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async handleDialogPull() {
      if (!this.commitDialog.repoPath) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitPull(this.commitDialog.repoPath)
        if (result.success) {
          alert('拉取成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '拉取失败')
        }
      } catch (e) {
        alert(`拉取失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async handleDialogPush() {
      if (!this.commitDialog.repoPath) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitPush(this.commitDialog.repoPath)
        if (result.success) {
          alert('推送成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '推送失败')
        }
      } catch (e) {
        alert(`推送失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async refreshCommitDialog() {
      try {
        this.commitDialog.loading = true
        const repoPath = this.commitDialog.repoPath
        const dirPath = this.commitDialog.dirPath

        // 先获取 brief，判断文件数量是否仍然过多
        const brief = await apiGetGitRepoBrief(dirPath)
        if (brief.isRepo && (brief.changesCount || 0) > 2000) {
          this.commitDialog.tooManyFilesCount = brief.changesCount
          this.commitDialog.files = []
          this.commitDialog.loading = false
          // 更新项目 git 角标（不阻塞）
          if (this.commitDialog.project) {
            this.commitDialog.project.git = brief
          }
          return
        }

        const [status, remoteInfo, lastCommit] = await Promise.all([
          apiGetGitStatus(repoPath),
          apiGetGitRemote(repoPath),
          apiGetGitLastCommit(repoPath)
        ])

        this.commitDialog.tooManyFilesCount = 0
        this.commitDialog.branch = status.branch
        this.commitDialog.ahead = status.ahead
        this.commitDialog.behind = status.behind
        this.commitDialog.remote = remoteInfo.remoteUrl || remoteInfo.remote
        this.commitDialog.lastCommit = lastCommit.hash ? lastCommit : null

        const files = this.buildCommitFiles(status, dirPath, repoPath)
        this.commitDialog.files = files
        this.commitDialog.commitMessage = ''

        // 更新项目 git 角标（不阻塞）
        if (this.commitDialog.project) {
          apiGetGitRepoBrief(repoPath).then((brief) => {
            this.commitDialog.project.git = brief
          }).catch(() => { })
        }
      } catch (e) {
        console.error('刷新弹窗失败:', e)
      } finally {
        this.commitDialog.loading = false
      }
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

    handleRestoreTerminals() {
      if (this.contextMenu.project) {
        appBusiness.loadProjectTerminals(this.contextMenu.project.id)
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

    async showContextMenu(e: MouseEvent, project: Project | null, type: 'project' | 'file' | 'directory' = 'project', path: string = '') {
      this.contextMenu = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        project,
        type,
        path
      }

      // 检查是否有可恢复的终端
      if (type === 'project' && project) {
        try {
          const terminals = await loadTerminals(project.path)
          this.hasTerminalsToRestore = terminals.length > 0
        } catch {
          this.hasTerminalsToRestore = false
        }
      } else {
        this.hasTerminalsToRestore = false
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

    showPreviewTooltip(e: MouseEvent, result: { file: string; path: string; line: number; preview?: string }) {
      if (result.preview) {
        const rect = (e.target as HTMLElement).getBoundingClientRect()
        this.hoveredPreview = {
          content: result.preview,
          x: rect.left,
          y: rect.bottom + 5
        }

        // 调整位置避免超出屏幕
        this.$nextTick(() => {
          const tooltip = document.querySelector('.preview-tooltip') as HTMLElement
          if (tooltip) {
            const tooltipRect = tooltip.getBoundingClientRect()
            if (tooltipRect.right > window.innerWidth) {
              this.hoveredPreview!.x = window.innerWidth - tooltipRect.width - 10
            }
            if (tooltipRect.bottom > window.innerHeight) {
              this.hoveredPreview!.y = rect.top - tooltipRect.height - 5
            }
          }
        })
      }
    },

    hidePreviewTooltip() {
      this.hoveredPreview = null
    },

    handleOutsideClick(e: MouseEvent) {
      // 检查点击是否在搜索区域外
      const searchPanel = this.$el.querySelector('.search-input-container')
      if (searchPanel && !searchPanel.contains(e.target as Node)) {
        this.hideHistoryDropdown()
      }
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

    handleTreeNodeClick(path: string) {
      console.log('Node clicked:', path)
    },

    handleSearchInput() {
      // 只在用户手动输入时重置索引，导航时不重置
      this.selectedHistoryIndex = -1
      this.showHistoryDropdown = true
    },

    hideHistoryDropdown() {
      this.showHistoryDropdown = false
      this.selectedHistoryIndex = -1
    },

    navigateHistory(direction: number) {
      const filtered = this.filteredHistory
      if (filtered.length === 0) return

      if (this.selectedHistoryIndex === -1) {
        this.selectedHistoryIndex = direction > 0 ? 0 : filtered.length - 1
      } else {
        this.selectedHistoryIndex += direction
        if (this.selectedHistoryIndex < 0) this.selectedHistoryIndex = filtered.length - 1
        if (this.selectedHistoryIndex >= filtered.length) this.selectedHistoryIndex = 0
      }

      // 更新搜索框内容，但不触发输入事件
      this.searchQuery = filtered[this.selectedHistoryIndex]
    },

    selectHistoryItem(item: string) {
      this.searchQuery = item
      this.selectedHistoryIndex = -1
      this.showHistoryDropdown = false
      this.handleSearch()
    },

    // 搜索历史持久化方法
    loadSearchHistory() {
      try {
        const saved = localStorage.getItem('searchHistory')
        if (saved) {
          this.searchHistory = JSON.parse(saved)
        }
      } catch (e) {
        console.error('Failed to load search history:', e)
      }
    },

    saveSearchHistory() {
      try {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory))
      } catch (e) {
        console.error('Failed to save search history:', e)
      }
    },

    handleSearch() {
      const query = this.searchQuery.trim()
      if (!query) {
        this.searchResults = []
        return
      }

      // 保存到历史记录
      if (!this.searchHistory.includes(query)) {
        this.searchHistory.unshift(query)
        if (this.searchHistory.length > 10) {
          this.searchHistory.pop()
        }
        // 持久化到 localStorage
        this.saveSearchHistory()
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

      // 解析扩展名（正则表达式）
      const extensions = this.searchExtensions.trim() || '*.*'

      this.searching = true
      this.expandedFiles = []

      // 执行文件内容搜索，限制返回结果数量避免界面卡顿
      apiSearchFileContent(searchPath, query, 200, extensions)
        .then(results => {
          this.searchResults = results.map(r => ({
            ...r
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
            content,
            line: result.line
          })
        })
      }
    },

    getMatchPreview(result: { file: string; path: string; line: number; preview?: string }): string {
      if (!result.preview) {
        return `第 ${result.line} 行`
      }

      let preview = result.preview.trim()
      const query = this.searchQuery.trim()

      // 如果preview包含多行，取中间那一行
      const lines = preview.split('\n')
      if (lines.length > 1) {
        const middleIndex = Math.floor(lines.length / 2)
        preview = lines[middleIndex].trim()
      }

      if (preview.length <= 30) {
        return preview
      }

      // 如果有搜索查询，尝试围绕查询进行裁剪，突出显示重点
      if (query) {
        const lowerPreview = preview.toLowerCase()
        const lowerQuery = query.toLowerCase()
        const queryIndex = lowerPreview.indexOf(lowerQuery)

        if (queryIndex !== -1) {
          // 计算裁剪的起始位置，让查询内容尽量居中
          const contextLength = 10 // 查询前后各保留多少字符
          let start = Math.max(0, queryIndex - contextLength)
          let end = Math.min(preview.length, queryIndex + query.length + contextLength)

          let cropped = ''
          if (start > 0) {
            cropped += '...'
          }
          cropped += preview.substring(start, end)
          if (end < preview.length) {
            cropped += '...'
          }

          return cropped
        }
      }

      // 默认裁剪方式：取前面部分
      return preview.substring(0, 30) + '...'
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

    handleSearchInDirectory(path?: string) {
      // 可以从 DirectoryTree 传入特定路径
      // 防止 event 对象被当作路径传入
      if (typeof path === 'object' && path !== null && 'clientX' in path) {
        path = undefined
      }
      const searchPath = path || this.contextMenu.path || this.contextMenu.project?.path
      // 确保 searchPath 是有效的字符串路径
      if (searchPath && typeof searchPath === 'string' && searchPath.length > 0 && !searchPath.startsWith('[object')) {
        this.activeTab = 'search'
        this.searchPath = searchPath
        this.searchQuery = ''
      }
      this.closeContextMenu()
    },

    handleRefreshDirectory(dirPath: string) {
      // 触发目录树重新加载
      // 通过切换 expandedId 来强制刷新
      const currentExpanded = this.expandedId
      this.expandedId = null
      this.$nextTick(() => {
        this.expandedId = currentExpanded
      })
    },

    handleOpenFile() {
      const filePath = this.contextMenu.path
      if (!filePath) {
        alert('文件路径无效')
        this.closeContextMenu()
        return
      }
      apiOpenProjectInEditor(filePath).catch(e => {
        alert(`打开失败: ${e}`)
      })
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
        try {
          await apiDeletePath(this.contextMenu.path)
        } catch (e) {
          alert(`删除失败: ${e}`)
        }
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

.search-header {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #3e3e42;
}

.search-title {
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

.search-extensions-input {
  flex: 1;
  padding: 4px 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 12px;
}

.search-extensions-input:focus {
  outline: none;
  border-color: #007acc;
}

.search-history-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 40px;
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  margin-top: 2px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
}

.search-history-item {
  padding: 6px 12px;
  font-size: 13px;
  color: #d4d4d4;
  cursor: pointer;
}

.search-history-item:hover {
  background: #094771;
}

.search-history-item.selected {
  background: #094771;
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

.search-empty {
  padding: 12px;
  color: #858585;
  font-size: 13px;
  text-align: center;
}

.search-warning {
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #5a1d1d;
  border: 1px solid #c42b1c;
  border-radius: 4px;
  color: #f48771;
  font-size: 12px;
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
  justify-content: space-between;
  width: 100%;
}

.project-name-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
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
  margin-right: 4px;
}

.git-badge-small {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 12px;
  height: 12px;
  padding: 0 2px;
  background: #5a8c5a;
  color: #fff;
  border-radius: 6px;
  font-size: 8px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
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
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 99999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.context-menu-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #333333;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #e8f0fe;
}

.context-menu-item.danger:hover {
  background: #fce8e6;
  color: #c42b1c;
}

.context-menu-separator {
  height: 1px;
  background: #e0e0e0;
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

.preview-tooltip {
  position: fixed;
  background: #ffffff;
  color: #333333;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  z-index: 99999;
  max-width: 600px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #d4d4d4;
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
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #333333;
}

.modal-close {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 20px;
  cursor: pointer;
}

.modal-close:hover {
  color: #333333;
}

.modal-body {
  padding: 16px;
}

.modal-body label {
  display: block;
  margin-bottom: 12px;
  color: #333333;
}

.modal-body input {
  width: 100%;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
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
  background: #007acc;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.path-input-row button:hover {
  background: #005a9e;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-confirm {
  padding: 6px 12px;
  background: #007acc;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.btn-confirm:hover:not(:disabled) {
  background: #005a9e;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
