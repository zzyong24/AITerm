// 纯业务逻辑类，不依赖 Pinia，不使用 reactive
import { eventBus } from '../utils/EventBus'
import {
  createTerminalSession as apiCreateTerminalSession,
  closeTerminalSession as apiCloseTerminalSession,
  terminalOutputListener,
  terminalClosedListener,
  terminalActivityListener,
  getProjects as apiGetProjects,
  getHomeDir as apiGetHomeDir,
  getEditorPath as apiGetEditorPath,
  setEditorPath as apiSetEditorPath,
  getTerminalFontSize as apiGetTerminalFontSize,
  setTerminalFontSize as apiSetTerminalFontSize,
  addProject as apiAddProject,
  removeProject as apiRemoveProject,
  saveTerminals as apiSaveTerminals,
  loadTerminals as apiLoadTerminals,
  saveEditors as apiSaveEditors,
  loadEditors as apiLoadEditors,
  readFile as apiReadFile,
  getFullState,
  updateFullState,
  persistTerminal,
  updatePersistedTerminal,
  removePersistedTerminal,
  updateEditors,
  removeEditor,
  PersistedState
} from '../api'

export interface Project {
  id: string
  name: string
  path: string
  group?: string
  git?: {
    isRepo: boolean
    changesCount: number
    ahead?: number
    behind?: number
  }
}

export interface ChildTerminal {
  id: string
  alive: boolean
}

export interface TerminalSession {
  id: string
  projectId: string | null
  projectName: string | null
  workingDir: string
  name: string
  alive: boolean
  lastActivity: number
  children: ChildTerminal[]
  activeSubId: string | null
}

export interface EditorTab {
  id: string
  projectId: string | null
  projectName: string | null
  path: string
  name: string
  content: string
  modified: boolean
  scrollToLine?: number
  scrollTrigger?: number
}

// Tab项（终端或编辑器或浏览器）
export interface TabItem {
  id: string
  type: 'terminal' | 'editor' | 'browser'
  name: string
  modified?: boolean
  path?: string
}

// 浏览器Tab
export interface BrowserTab {
  id: string
  projectId: string | null
  projectName: string | null
  url: string
  name: string
  zoom: number
}

// 项目Tab（包含该项目的所有终端和编辑器）
export interface ProjectTab {
  projectId: string
  projectName: string
  items: TabItem[]
  activeItemId: string | null
}

// 事件类型
export const AppEvents = {
  PROJECTS_CHANGE: 'projectsChange',
  SESSIONS_CHANGE: 'sessionsChange',
  EDITORS_CHANGE: 'editorsChange',
  BROWSERS_CHANGE: 'browsersChange',
  TABS_CHANGE: 'tabsChange',
  ACTIVE_PROJECT_CHANGE: 'activeProjectChange',
  SETTINGS_CHANGE: 'settingsChange',
  ACTIVITY_CHANGE: 'activityChange',
  INITIALIZED: 'initialized',
  SESSION_WAITING: 'sessionWaiting',
  SESSION_FAILED: 'sessionFailed'
} as const

// 响应式业务类 - 数据驱动UI的核心
class AppBusinessClass {
  // ============ 基础数据 ============
  projects: Project[] = []
  sessions: TerminalSession[] = []
  editors: EditorTab[] = []
  browsers: BrowserTab[] = []
  activeIndex = -1
  activeEditorId: string | null = null
  homeDir = ''
  editorPath = ''
  terminalFontSize = 14
  sidebarCollapsed = false
  sidebarWidth = 260
  showSettings = false
  // 从 SQLite 加载的终端数据（供 restoreAllTerminals 使用）
  persistedTerminals: any[] = []

  // 活跃度数据
  activityData: Record<string, { last: number; bytes: number }> = {}

  // 需要人工干预的会话
  waitingForInput: Record<string, string> = {} // sessionId -> 原因描述
  failedSessions: Record<string, number> = {} // sessionId -> 退出码

  // ============ 事件通知 ============
  private notifyProjectsChange() {
    eventBus.emit(AppEvents.PROJECTS_CHANGE, [...this.projects])
  }

  private notifySessionsChange() {
    eventBus.emit(AppEvents.SESSIONS_CHANGE, [...this.sessions])
  }

  private notifyEditorsChange() {
    eventBus.emit(AppEvents.EDITORS_CHANGE, [...this.editors])
  }

  private notifyBrowsersChange() {
    eventBus.emit(AppEvents.BROWSERS_CHANGE, [...this.browsers])
  }

  private notifyTabsChange() {
    eventBus.emit(AppEvents.TABS_CHANGE, [...this.tabs])
  }

  private notifyActiveProjectChange(projectId: string) {
    eventBus.emit(AppEvents.ACTIVE_PROJECT_CHANGE, projectId)
  }

  private notifySettingsChange() {
    eventBus.emit(AppEvents.SETTINGS_CHANGE, {
      sidebarCollapsed: this.sidebarCollapsed,
      sidebarWidth: this.sidebarWidth,
      showSettings: this.showSettings,
      editorPath: this.editorPath,
      terminalFontSize: this.terminalFontSize
    })
  }

  setSidebarWidth(width: number) {
    this.sidebarWidth = Math.max(180, Math.min(500, width))
    this.notifySettingsChange()
  }

  private notifyActivityChange(sessionId: string, data: { last: number; bytes: number }) {
    eventBus.emit(AppEvents.ACTIVITY_CHANGE, sessionId, { ...data })
  }

  private notifySessionWaiting(sessionId: string, reason: string) {
    eventBus.emit(AppEvents.SESSION_WAITING, sessionId, reason)
  }

  private notifySessionFailed(sessionId: string, exitCode: number) {
    eventBus.emit(AppEvents.SESSION_FAILED, sessionId, exitCode)
  }

  addWaitingForInput(sessionId: string, reason: string) {
    this.waitingForInput[sessionId] = reason
    this.notifySessionWaiting(sessionId, reason)
  }

  clearWaitingForInput(sessionId: string) {
    if (this.waitingForInput[sessionId]) {
      delete this.waitingForInput[sessionId]
      this.notifySessionsChange()
    }
  }

  setSessionFailed(sessionId: string, exitCode: number) {
    this.failedSessions[sessionId] = exitCode
    this.notifySessionFailed(sessionId, exitCode)
  }

  addActivity(sessionId: string, bytes: number) {
    const now = Date.now()
    this.activityData[sessionId] = {
      last: now,
      bytes: bytes
    }
    this.notifyActivityChange(sessionId, this.activityData[sessionId])
  }

  private notifyInitialized() {
    eventBus.emit(AppEvents.INITIALIZED, {
      projects: [...this.projects],
      homeDir: this.homeDir,
      editorPath: this.editorPath,
      terminalFontSize: this.terminalFontSize
    })
  }

  setEditorPath(path: string) {
    this.editorPath = path
    this.notifySettingsChange()
    apiSetEditorPath(path)
  }

  setTerminalFontSize(fontSize: number) {
    this.terminalFontSize = fontSize
    this.notifySettingsChange()
    apiSetTerminalFontSize(fontSize)
  }

  // ============ UI状态（驱动Tabs） ============
  // 当前激活的项目ID
  activeProjectId: string = 'default'
  // 所有项目Tabs
  tabs: ProjectTab[] = []

  // ============ 项目管理 ============
  async addProject(name: string, path: string, group?: string): Promise<Project> {
    const project = await apiAddProject(name, path, group)
    this.projects.push(project)
    this.notifyProjectsChange()
    // 同步到 SQLite
    try {
      await updateFullState({
        projects: [{ id: project.id, name: project.name, path: project.path, order: 0 }]
      })
    } catch (e) {
      console.error('[AppBusiness] Failed to sync project to SQLite:', e)
    }
    return project
  }

  async removeProject(id: string) {
    // 先关闭该项目关联的所有终端
    const projectSessions = this.sessions.filter(s => s.projectId === id)
    for (const session of projectSessions) {
      await this.closeSession(session.id)
    }
    await apiRemoveProject(id)
    this.projects = this.projects.filter(p => p.id !== id)
    this.notifyProjectsChange()
    // 从 SQLite 中移除项目（软删除：更新 lastAccessedAt 不再包含该 ID）
    try {
      // 通过批量更新移除项目 - 在下次 sync 时会排除
      this.scheduleSyncProjectsToSQLite()
    } catch (e) {
      console.error('[AppBusiness] Failed to sync project removal to SQLite:', e)
    }
  }

  async refreshProjects(): Promise<void> {
    try {
      this.projects = await apiGetProjects()
      this.notifyProjectsChange()
    } catch (err) {
      console.error('Failed to refresh projects:', err)
    }
  }

  renameProject(id: string, newName: string): Project | null {
    const project = this.projects.find(p => p.id === id)
    if (project) {
      project.name = newName
      this.notifyProjectsChange()
      // 同步到 SQLite
      this.scheduleSyncProjectsToSQLite()
      return project
    }
    return null
  }

  // ============ 项目Tab管理 ============
  // 确保项目Tab存在
  ensureProjectTab(projectId: string, projectName: string): ProjectTab {
    let tab = this.tabs.find(t => t.projectId === projectId)
    if (!tab) {
      tab = {
        projectId,
        projectName,
        items: [],
        activeItemId: null
      }
      this.tabs.push(tab)
    }
    return tab
  }

  // 切换到项目Tab
  switchProjectTab(projectId: string) {
    this.activeProjectId = projectId
    this.notifyActiveProjectChange(projectId)
  }

  // 关闭项目Tab
  async closeProjectTab(projectId: string) {
    const tab = this.tabs.find(t => t.projectId === projectId)
    if (!tab) {
      console.log('[AppBusiness] closeProjectTab: tab not found', projectId)
      return
    }

    console.log('[AppBusiness] closeProjectTab: starting', { projectId, itemsCount: tab.items.length })

    // 关闭所有终端和编辑器
    for (const item of tab.items) {
      console.log('[AppBusiness] closeProjectTab: closing item', { type: item.type, id: item.id })
      if (item.type === 'terminal') {
        await this.closeSession(item.id)
      } else {
        this.closeEditor(item.id)
      }
    }

    console.log('[AppBusiness] closeProjectTab: completed', { projectId })

    this.tabs = this.tabs.filter(t => t.projectId !== projectId)
    this.notifyTabsChange()

    if (this.activeProjectId === projectId) {
      this.activeProjectId = this.tabs.length > 0 ? this.tabs[0].projectId : 'default'
      this.notifyActiveProjectChange(this.activeProjectId)
    }
  }

  // ============ 初始化 ============
  async initialize() {
    try {
      console.log('[AppBusiness] Starting initialization...')

      // Step 1: 尝试从 SQLite 获取跨端持久化状态
      let loadedFromSQLite = false
      try {
        const fullState = await getFullState()
        if (fullState.projects && fullState.projects.length > 0) {
          console.log('[AppBusiness] Loading state from SQLite...')
          this.projects = fullState.projects.map(p => ({
            id: p.id,
            name: p.name,
            path: p.path,
            group: undefined,
            git: undefined
          }))

          // 从 SQLite 恢复 terminals 和 editors
          if (fullState.terminals && fullState.terminals.length > 0) {
            console.log('[AppBusiness] Loaded terminals from SQLite:', fullState.terminals.length)
            // 存储终端数据供 restoreAllTerminals 使用
            this.persistedTerminals = fullState.terminals
          }

          loadedFromSQLite = true
          console.log('[AppBusiness] Loaded from SQLite:', { projects: this.projects.length })
        }
      } catch (e) {
        console.log('[AppBusiness] SQLite load failed, using individual APIs:', e)
      }

      // Step 2: 如果没有从 SQLite 加载，使用原有 API 获取数据
      if (!loadedFromSQLite) {
        const [projects, homeDir, editorPath, terminalFontSize] = await Promise.all([
          apiGetProjects(),
          apiGetHomeDir(),
          apiGetEditorPath(),
          apiGetTerminalFontSize()
        ])
        console.log('[AppBusiness] API results:', { projects: projects.length, homeDir, editorPath, terminalFontSize })
        this.projects = projects
        this.homeDir = homeDir
        this.editorPath = editorPath || ''
        this.terminalFontSize = terminalFontSize || 14
      } else {
        // 从 SQLite 加载时也要获取基础设置
        const [homeDir, editorPath, terminalFontSize] = await Promise.all([
          apiGetHomeDir(),
          apiGetEditorPath(),
          apiGetTerminalFontSize()
        ])
        this.homeDir = homeDir
        this.editorPath = editorPath || ''
        this.terminalFontSize = terminalFontSize || 14
      }

      // Step 3: 自动恢复所有项目的终端
      await this.restoreAllTerminals()

      // Step 4: 自动恢复所有项目的编辑器
      await this.restoreAllEditors()

      // Step 5: 同步状态到 SQLite（如果从 API 加载的）
      if (!loadedFromSQLite && this.projects.length > 0) {
        this.syncStateToSQLite()
      }

      this.notifyInitialized()
      this.notifyProjectsChange()
      this.notifySettingsChange()
    } catch (e) {
      console.error('Failed to initialize:', e)
      // 尝试单独获取各项数据，避免一个失败影响其他
      try {
        this.projects = await apiGetProjects()
        this.notifyProjectsChange()
      } catch (err) {
        console.error('Failed to get projects:', err)
        this.projects = []
      }
      try {
        this.homeDir = await apiGetHomeDir()
      } catch (err) {
        console.error('Failed to get home dir:', err)
        this.homeDir = ''
      }
      try {
        this.editorPath = await apiGetEditorPath() || ''
        this.notifySettingsChange()
      } catch (err) {
        console.error('Failed to get editor path:', err)
        this.editorPath = ''
      }
      try {
        const fontSize = await apiGetTerminalFontSize()
        console.log('[AppBusiness] Got terminalFontSize from API:', fontSize)
        this.terminalFontSize = fontSize || 14
        console.log('[AppBusiness] After catch assignment, terminalFontSize:', this.terminalFontSize)
      } catch (err) {
        console.error('Failed to get terminal font size:', err)
        this.terminalFontSize = 14
      }
      this.notifyInitialized()
    }
  }

  // 同步状态到 SQLite
  private async syncStateToSQLite() {
    try {
      const state: Partial<PersistedState> = {
        projects: this.projects.map(p => ({
          id: p.id,
          name: p.name,
          path: p.path,
          order: 0
        }))
      }
      await updateFullState(state)
      console.log('[AppBusiness] State synced to SQLite')
    } catch (e) {
      console.error('[AppBusiness] Failed to sync state to SQLite:', e)
    }
  }

  // 自动恢复所有项目的终端
  async restoreAllTerminals() {
    // 如果有从 SQLite 加载的终端数据，使用它而不是调 API
    if (this.persistedTerminals.length > 0) {
      console.log('[AppBusiness] Restoring terminals from SQLite:', this.persistedTerminals.length)
      for (const terminal of this.persistedTerminals) {
        // 找到对应的项目
        const project = this.projects.find(p => p.id === terminal.projectId)
        if (project) {
          try {
            const sessionId = await this.launchTerminal(project.id, project.name, terminal.cwd)
            if (terminal.name && terminal.name !== project.name) {
              this.renameSession(sessionId, terminal.name)
            }
            console.log('[AppBusiness] Restored terminal:', terminal.name, 'for project:', project.name)
          } catch (e) {
            console.warn('[AppBusiness] Failed to restore terminal:', terminal.name, e)
          }
        }
      }
      return
    }

    // 兜底：从 API 加载（HTTP 模式或旧数据）
    for (const project of this.projects) {
      try {
        const terminals = await apiLoadTerminals(project.path)
        if (terminals.length > 0) {
          console.log('[AppBusiness] Auto-restoring terminals for project:', project.name)
          for (const terminal of terminals) {
            const sessionId = await this.launchTerminal(project.id, project.name, terminal.workingDir)
            if (terminal.name && terminal.name !== project.name) {
              this.renameSession(sessionId, terminal.name)
            }
          }
        }
      } catch (e) {
        console.warn('[AppBusiness] Failed to restore terminals for project:', project.name, e)
      }
    }
  }

  // 自动恢复所有项目的编辑器
  async restoreAllEditors() {
    for (const project of this.projects) {
      try {
        const editors = await apiLoadEditors(project.path)
        if (editors.length > 0) {
          console.log('[AppBusiness] Auto-restoring editors for project:', project.name)
          for (const editor of editors) {
            let content = ''
            try {
              const fileContent = await apiReadFile(editor.path)
              content = fileContent || ''
            } catch (e) {
              console.warn('[Editors] Failed to read file:', editor.path, e)
            }
            this.openEditor(project.id, project.name, editor.path, content, editor.scrollToLine)
          }
        }
      } catch (e) {
        console.warn('[AppBusiness] Failed to restore editors for project:', project.name, e)
      }
    }
  }

  // ============ 终端会话 ============
  async createSession(projectId: string | null, projectName: string | null, workingDir?: string): Promise<string> {
    const sessionId = await apiCreateTerminalSession(projectId, projectName, workingDir)
    const newSession: TerminalSession = {
      id: sessionId,
      projectId,
      projectName,
      workingDir: workingDir || '~',
      name: projectName || '终端',
      alive: true,
      lastActivity: 0,
      children: [],
      activeSubId: null
    }
    this.sessions.push(newSession)
    this.activeIndex = this.sessions.length - 1
    this.notifySessionsChange()
    return sessionId
  }

  renameSession(sessionId: string, name: string) {
    const session = this.sessions.find(s => s.id === sessionId)
    if (!session) return
    // 验证：只允许中文、英文、-、_
    const validName = name.replace(/[^\w\u4e00-\u9fa5\-_]/g, '')
    session.name = validName
    // 同时更新 tab 中的名称
    this.tabs = this.tabs.map(tab => ({
      ...tab,
      items: tab.items.map(item =>
        item.id === sessionId ? { ...item, name: validName } : item
      )
    }))
    this.notifySessionsChange()
    this.notifyTabsChange()
    // 保存
    if (session.projectId) {
      this.scheduleSaveTerminals(session.projectId)
    }
  }

  async closeSession(sessionId: string) {
    console.log('[AppBusiness] closeSession: starting', { sessionId })
    // 先保存项目 ID，关闭后需要更新持久化
    const session = this.sessions.find(s => s.id === sessionId)
    const projectId = session?.projectId
    // 调用 API 关闭后端终端
    try {
      await apiCloseTerminalSession(sessionId)
      console.log('[AppBusiness] closeSession: apiCloseTerminalSession succeeded', { sessionId })
    } catch (e) {
      console.error('[AppBusiness] closeSession: apiCloseTerminalSession failed', { sessionId, error: e })
      /* ignore */ }

    // 从 tabs 中移除对应的 item
    this.tabs = this.tabs.map(tab => {
      const newItems = tab.items.filter(i => i.id !== sessionId)
      return {
        ...tab,
        items: newItems,
        activeItemId: newItems.length > 0 ? newItems[0].id : null
      }
    })

    // 从 sessions 中移除
    const index = this.sessions.findIndex(s => s.id === sessionId)
    if (index !== -1) {
      this.sessions.splice(index, 1)
    }

    // 清理活跃度数据，防止内存泄漏
    delete this.activityData[sessionId]
    delete this.waitingForInput[sessionId]
    delete this.failedSessions[sessionId]

    // 通知更新
    this.notifySessionsChange()
    this.notifyTabsChange()
    // 更新持久化
    if (projectId) {
      this.scheduleSaveTerminals(projectId)
    }
  }

  // ============ 启动终端（创建Tab和Session） ============
  async launchTerminal(projectId: string, projectName: string, workingDir?: string): Promise<string> {
    if (!projectId) {
      console.error('终端必须归属于项目')
      return ''
    }

    const sessionId = await this.createSession(projectId, projectName, workingDir || this.projects.find(p => p.id === projectId)?.path)

    // 添加到 tabs
    this.tabs = this.tabs.map(tab => {
      if (tab.projectId !== projectId) return tab
      const newItems = [...tab.items, {
        id: sessionId,
        type: 'terminal' as const,
        name: projectName || '终端'
      }]
      return { ...tab, items: newItems, activeItemId: sessionId }
    })

    // 如果 tab 不存在则创建
    if (!this.tabs.find(t => t.projectId === projectId)) {
      this.tabs.push({
        projectId,
        projectName: projectName || '默认',
        items: [{
          id: sessionId,
          type: 'terminal' as const,
          name: projectName || '终端'
        }],
        activeItemId: sessionId
      })
    }

    this.activeProjectId = projectId
    this.notifyActiveProjectChange(projectId)
    this.notifyTabsChange()
    // 延迟保存
    this.scheduleSaveTerminals(projectId)
    return sessionId
  }

  // ============ 终端列表保存/恢复 ============
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  private scheduleSaveTerminals(projectId: string) {
    // 防抖：500ms 内只保存一次
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveProjectTerminals(projectId)
    }, 500)
  }

  async saveProjectTerminals(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId)
    if (!project) return

    const projectSessions = this.sessions.filter(s => s.projectId === projectId)
    const terminals = projectSessions.map(s => ({
      id: s.id,
      name: s.name,
      workingDir: s.workingDir,
      children: s.children,
      activeSubId: s.activeSubId
    }))

    try {
      await apiSaveTerminals(project.path, terminals)
      console.log('[Terminals] Saved terminals for project:', project.name, terminals)
    } catch (e) {
      console.error('[Terminals] Failed to save terminals:', e)
    }
    // 同步到 SQLite
    this.scheduleSyncTerminalsToSQLite()
  }

  // ============ 编辑器列表保存/恢复 ============
  private saveEditorsTimer: ReturnType<typeof setTimeout> | null = null

  private scheduleSaveEditors(projectId: string) {
    if (this.saveEditorsTimer) {
      clearTimeout(this.saveEditorsTimer)
    }
    this.saveEditorsTimer = setTimeout(() => {
      this.saveProjectEditors(projectId)
    }, 500)
  }

  async saveProjectEditors(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId)
    if (!project) return

    const projectEditors = this.editors.filter(e => e.projectId === projectId)
    const editors = projectEditors.map(e => ({
      id: e.id,
      path: e.path,
      name: e.name,
      scrollToLine: e.scrollToLine
    }))

    try {
      await apiSaveEditors(project.path, editors)
      console.log('[Editors] Saved editors for project:', project.name, editors)
    } catch (e) {
      console.error('[Editors] Failed to save editors:', e)
    }
    // 同步到 SQLite
    this.scheduleSyncEditorsToSQLite(projectId)
  }

  // ============ SQLite 跨端持久化同步 ============
  private syncProjectsTimer: ReturnType<typeof setTimeout> | null = null
  private syncEditorsTimer: ReturnType<typeof setTimeout> | null = null

  private scheduleSyncProjectsToSQLite() {
    if (this.syncProjectsTimer) {
      clearTimeout(this.syncProjectsTimer)
    }
    this.syncProjectsTimer = setTimeout(() => {
      this.syncProjectsToSQLite()
    }, 1000)
  }

  private async syncProjectsToSQLite() {
    try {
      await updateFullState({
        projects: this.projects.map(p => ({
          id: p.id,
          name: p.name,
          path: p.path,
          order: 0
        }))
      })
      console.log('[AppBusiness] Synced projects to SQLite')
    } catch (e) {
      console.error('[AppBusiness] Failed to sync projects to SQLite:', e)
    }
  }

  private scheduleSyncEditorsToSQLite(projectId: string) {
    if (this.syncEditorsTimer) {
      clearTimeout(this.syncEditorsTimer)
    }
    this.syncEditorsTimer = setTimeout(() => {
      this.syncEditorsToSQLite(projectId)
    }, 1000)
  }

  private async syncEditorsToSQLite(projectId: string) {
    try {
      const projectEditors = this.editors.filter(e => e.projectId === projectId)
      const editors = projectEditors.map(e => ({
        projectId: e.projectId || '',
        id: e.id,
        path: e.path,
        name: e.name,
        scrollToLine: e.scrollToLine
      }))
      await updateEditors(editors)
      console.log('[AppBusiness] Synced editors to SQLite for project:', projectId)
    } catch (e) {
      console.error('[AppBusiness] Failed to sync editors to SQLite:', e)
    }
  }

  private syncTerminalsTimer: ReturnType<typeof setTimeout> | null = null

  private scheduleSyncTerminalsToSQLite() {
    if (this.syncTerminalsTimer) {
      clearTimeout(this.syncTerminalsTimer)
    }
    this.syncTerminalsTimer = setTimeout(() => {
      this.syncTerminalsToSQLite()
    }, 1000)
  }

  private async syncTerminalsToSQLite() {
    try {
      const terminals = this.sessions.map(s => ({
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        cwd: s.workingDir,
        taskSlug: undefined,
        history: []
      }))
      // 使用批量更新 API
      await updateFullState({ terminals })
      console.log('[AppBusiness] Synced terminals to SQLite')
    } catch (e) {
      console.error('[AppBusiness] Failed to sync terminals to SQLite:', e)
    }
  }

  // ============ 编辑器恢复相关 ============

  async loadProjectEditors(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId)
    if (!project) return

    try {
      const editors = await apiLoadEditors(project.path)
      console.log('[Editors] Loaded editors for project:', project.name, editors)

      if (editors.length === 0) return

      // 关闭现有编辑器
      const existingEditors = this.editors.filter(e => e.projectId === projectId)
      for (const editor of existingEditors) {
        this.closeEditor(editor.id)
      }

      // 恢复编辑器
      for (const editor of editors) {
        // 读取文件内容
        let content = ''
        try {
          const fileContent = await apiReadFile(editor.path)
          content = fileContent || ''
        } catch (e) {
          console.warn('[Editors] Failed to read file:', editor.path, e)
        }
        this.openEditor(projectId, project.name, editor.path, content, editor.scrollToLine)
      }
    } catch (e) {
      console.error('[Editors] Failed to load editors:', e)
    }
  }

  async loadProjectTerminals(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId)
    if (!project) return

    try {
      const terminals = await apiLoadTerminals(project.path)
      console.log('[Terminals] Loaded terminals for project:', project.name, terminals)

      if (terminals.length === 0) return

      // 先关闭现有的项目终端（用户要恢复保存的列表）
      const existingSessions = this.sessions.filter(s => s.projectId === projectId)
      for (const session of existingSessions) {
        await this.closeSession(session.id)
      }

      // 为每个终端创建会话
      for (const terminal of terminals) {
        const sessionId = await this.launchTerminal(projectId, project.name, terminal.workingDir)
        // 恢复名称
        if (terminal.name && terminal.name !== project.name) {
          this.renameSession(sessionId, terminal.name)
        }
      }
    } catch (e) {
      console.error('[Terminals] Failed to load terminals:', e)
    }
  }

  // ============ 编辑器 ============
  openEditor(projectId: string | null, projectName: string | null, path: string, content: string = '', scrollToLine?: number): string {
    if (!projectId) {
      console.error('编辑器必须归属于项目')
      return ''
    }
    const tab = this.ensureProjectTab(projectId, projectName || '默认')

    // 检查是否已经打开
    const existing = tab.items.find(i => i.type === 'editor' && i.path === path)
    if (existing) {
      this.tabs = this.tabs.map(t => {
        if (t.projectId !== projectId) return t
        return { ...t, activeItemId: existing.id }
      })
      this.activeProjectId = projectId
      this.notifyActiveProjectChange(projectId)
      this.notifyTabsChange()
      // 如果需要滚动到指定行，更新编辑器状态
      if (scrollToLine) {
        this.updateEditorScrollToLine(existing.id, scrollToLine)
      }
      return existing.id
    }

    // 调用 store 创建编辑器
    const id = `editor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.editors.push({
      id,
      projectId,
      projectName,
      path,
      name: path.split('/').pop() || path,
      content,
      modified: false,
      scrollToLine
    })
    this.activeEditorId = id
    this.notifyEditorsChange()

    // 添加到 tabs
    this.tabs = this.tabs.map(t => {
      if (t.projectId !== projectId) return t
      return {
        ...t,
        items: [...t.items, {
          id,
          type: 'editor' as const,
          name: path.split('/').pop() || path,
          modified: false,
          path
        }],
        activeItemId: id
      }
    })

    this.activeProjectId = projectId
    this.notifyActiveProjectChange(projectId)
    this.notifyTabsChange()
    // 保存编辑器列表
    if (projectId) {
      this.scheduleSaveEditors(projectId)
    }

    return id
  }

  closeEditor(editorId: string) {
    // 保存 projectId 用于后续更新持久化
    const editor = this.editors.find(e => e.id === editorId)
    const projectId = editor?.projectId
    // 从 tabs 中移除
    this.tabs = this.tabs.map(tab => {
      const newItems = tab.items.filter(i => i.id !== editorId)
      return {
        ...tab,
        items: newItems,
        activeItemId: newItems.length > 0 ? newItems[0].id : null
      }
    })

    // 从 editors 中移除
    const editorIndex = this.editors.findIndex(e => e.id === editorId)
    if (editorIndex !== -1) {
      this.editors.splice(editorIndex, 1)
    }

    if (this.activeEditorId === editorId) {
      this.activeEditorId = this.editors.length > 0 ? this.editors[this.editors.length - 1].id : null
    }
    this.notifyEditorsChange()
    this.notifyTabsChange()
    // 更新持久化
    if (projectId) {
      this.scheduleSaveEditors(projectId)
    }
  }

  // ============ 浏览器 ============
  launchBrowser(projectId: string, projectName: string, url: string = ''): string {
    if (!projectId) {
      console.error('浏览器必须归属于项目')
      return ''
    }
    const tab = this.ensureProjectTab(projectId, projectName || '默认')

    // 创建新浏览器
    const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const browserName = url.startsWith('http') ? new URL(url).hostname : url
    this.browsers.push({
      id,
      projectId,
      projectName,
      url,
      name: browserName,
      zoom: 100
    })
    this.notifyBrowsersChange()

    // 添加到 tabs
    this.tabs = this.tabs.map(t => {
      if (t.projectId !== projectId) return t
      return {
        ...t,
        items: [...t.items, {
          id,
          type: 'browser' as const,
          name: browserName
        }],
        activeItemId: id
      }
    })

    this.activeProjectId = projectId
    this.notifyActiveProjectChange(projectId)
    this.notifyTabsChange()

    return id
  }

  closeBrowser(browserId: string) {
    // 从 tabs 中移除
    this.tabs = this.tabs.map(tab => {
      const newItems = tab.items.filter(i => i.id !== browserId)
      return {
        ...tab,
        items: newItems,
        activeItemId: newItems.length > 0 ? newItems[0].id : null
      }
    })

    // 从 browsers 中移除
    const browserIndex = this.browsers.findIndex(b => b.id === browserId)
    if (browserIndex !== -1) {
      this.browsers.splice(browserIndex, 1)
    }

    this.notifyBrowsersChange()
    this.notifyTabsChange()
  }

  updateBrowserUrl(browserId: string, url: string) {
    const browser = this.browsers.find(b => b.id === browserId)
    if (browser) {
      browser.url = url
      this.notifyBrowsersChange()
    }
  }

  updateBrowserZoom(browserId: string, zoom: number) {
    const browser = this.browsers.find(b => b.id === browserId)
    if (browser) {
      browser.zoom = Math.max(25, Math.min(200, zoom))
      this.notifyBrowsersChange()
    }
  }

  updateEditorContent(editorId: string, content: string) {
    const editor = this.editors.find(e => e.id === editorId)
    if (editor) {
      editor.content = content
      editor.modified = true
      this.notifyEditorsChange()
    }
  }

  markEditorSaved(editorId: string) {
    const editor = this.editors.find(e => e.id === editorId)
    if (editor) {
      editor.modified = false
      this.notifyEditorsChange()
    }
  }

  updateEditorScrollToLine(editorId: string, line: number | undefined) {
    console.log('[AppBusiness] updateEditorScrollToLine called', { editorId, line })
    const editor = this.editors.find(e => e.id === editorId)
    if (editor) {
      editor.scrollToLine = line
      // 添加 trigger 来强制触发更新
      editor.scrollTrigger = Date.now()
      console.log('[AppBusiness] Updating editor', { editorId, scrollToLine: editor.scrollToLine, scrollTrigger: editor.scrollTrigger })
      this.notifyEditorsChange()
    } else {
      console.log('[AppBusiness] Editor not found', editorId)
    }
  }

  // ============ 选择/激活 ============
  selectItem(itemId: string, type: 'terminal' | 'editor') {
    // Find which project owns this item
    let targetProjectId = this.activeProjectId
    if (type === 'terminal') {
      const session = this.sessions.find(s => s.id === itemId)
      if (session?.projectId) {
        targetProjectId = session.projectId
      }
    } else {
      const editor = this.editors.find(e => e.id === itemId)
      if (editor?.projectId) {
        targetProjectId = editor.projectId
      }
    }

    // Switch project if needed (update both activeProjectId and tabs atomically)
    if (targetProjectId !== this.activeProjectId) {
      this.activeProjectId = targetProjectId
      this.notifyActiveProjectChange(targetProjectId)
    }

    // Update the target project's tab to select the item
    this.tabs = this.tabs.map(tab => {
      if (tab.projectId !== targetProjectId) return tab
      return { ...tab, activeItemId: itemId }
    })
    this.notifyTabsChange()

    if (type === 'terminal') {
      this.activeIndex = this.sessions.findIndex(s => s.id === itemId)
    } else {
      this.activeEditorId = itemId
    }
  }

  setActiveIndex(index: number) {
    this.activeIndex = index
    this.notifySessionsChange()
  }

  setActiveEditor(editorId: string) {
    if (this.editors.find(e => e.id === editorId)) {
      this.activeEditorId = editorId
      this.notifyEditorsChange()
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed
    this.notifySettingsChange()
  }

  toggleSettings() {
    this.showSettings = !this.showSettings
    this.notifySettingsChange()
  }

  // ============ Getters ============
  get currentTab(): ProjectTab | undefined {
    return this.tabs.find(t => t.projectId === this.activeProjectId)
  }

  get currentItems(): TabItem[] {
    const tab = this.currentTab
    if (!tab) return []

    // 合并 tabs.items 和 editors，编辑器用 store 的 modified 状态
    return tab.items.map(item => {
      if (item.type === 'editor') {
        const storeEditor = this.editors.find(e => e.id === item.id)
        return {
          ...item,
          modified: storeEditor?.modified || false
        }
      }
      return item
    })
  }

  get currentActiveTerminalId(): string | null {
    const tab = this.currentTab
    if (!tab?.activeItemId) return null
    const item = tab.items?.find(i => i.id === tab.activeItemId)
    return item?.type === 'terminal' ? item.id : null
  }

  get currentActiveEditorId(): string | null {
    const tab = this.currentTab
    if (!tab?.activeItemId) return null
    const item = tab.items?.find(i => i.id === tab.activeItemId)
    return item?.type === 'editor' ? item.id : null
  }

  get currentSession(): TerminalSession | null {
    if (this.activeIndex >= 0 && this.activeIndex < this.sessions.length) {
      return this.sessions[this.activeIndex]
    }
    return null
  }

  get currentEditor(): EditorTab | null {
    if (this.activeEditorId) {
      return this.editors.find(e => e.id === this.activeEditorId) || null
    }
    return null
  }

  getSessionWorkingDir(sessionId: string): string {
    const session = this.sessions.find(s => s.id === sessionId)
    return session?.workingDir || ''
  }

  getSessionChildren(sessionId: string) {
    const session = this.sessions.find(s => s.id === sessionId)
    return session?.children || []
  }

  getSessionActiveSubId(sessionId: string): string | null {
    const session = this.sessions.find(s => s.id === sessionId)
    return session?.activeSubId || null
  }

  getProjectName(projectId: string): string {
    const tab = this.tabs.find(t => t.projectId === projectId)
    return tab?.projectName || this.projects.find(p => p.id === projectId)?.name || '默认'
  }

  getProjectPath(projectId: string): string {
    return this.projects.find(p => p.id === projectId)?.path || ''
  }

  get projectTabList(): string[] {
    return this.tabs.map(t => t.projectId)
  }

  // ============ 文件系统同步 ============
  // 清理已不存在的文件和对应的编辑器
  async cleanupInvalidEditors(): Promise<void> {
    const invalidEditors: string[] = []

    // 检查每个编辑器的文件是否还存在
    for (const editor of this.editors) {
      if (!editor.path) continue
      try {
        await apiReadFile(editor.path)
      } catch {
        // 文件不存在，标记需要关闭
        invalidEditors.push(editor.id)
        console.log('[AppBusiness] File no longer exists:', editor.path)
      }
    }

    // 关闭所有无效编辑器
    for (const editorId of invalidEditors) {
      this.closeEditor(editorId)
      console.log('[AppBusiness] Closed invalid editor:', editorId)
    }

    if (invalidEditors.length > 0) {
      console.log('[AppBusiness] Cleaned up', invalidEditors.length, 'invalid editors')
    }
  }
}

// 单例 - 响应式
export const appBusiness = new AppBusinessClass()
