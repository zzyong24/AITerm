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
  loadTerminals as apiLoadTerminals
} from '../api'

export interface Project {
  id: string
  name: string
  path: string
  group?: string
  git?: {
    isRepo: boolean
    changesCount: number
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

// Tab项（终端或编辑器）
export interface TabItem {
  id: string
  type: 'terminal' | 'editor'
  name: string
  modified?: boolean
  path?: string
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
  TABS_CHANGE: 'tabsChange',
  ACTIVE_PROJECT_CHANGE: 'activeProjectChange',
  SETTINGS_CHANGE: 'settingsChange',
  ACTIVITY_CHANGE: 'activityChange',
  INITIALIZED: 'initialized'
} as const

// 响应式业务类 - 数据驱动UI的核心
class AppBusinessClass {
  // ============ 基础数据 ============
  projects: Project[] = []
  sessions: TerminalSession[] = []
  editors: EditorTab[] = []
  activeIndex = -1
  activeEditorId: string | null = null
  homeDir = ''
  editorPath = ''
  terminalFontSize = 14
  sidebarCollapsed = false
  sidebarWidth = 260
  showSettings = false

  // 活跃度数据
  activityData: Record<string, { last: number; bytes: number }> = {}

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

  private notifyInitialized() {
    eventBus.emit(AppEvents.INITIALIZED, {
      projects: [...this.projects],
      homeDir: this.homeDir,
      editorPath: this.editorPath,
      terminalFontSize: this.terminalFontSize
    })
  }

  addActivity(sessionId: string, bytes: number) {
    const now = Date.now()
    this.activityData[sessionId] = {
      last: now,
      bytes: bytes
    }
    this.notifyActivityChange(sessionId, this.activityData[sessionId])
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
    if (!tab) return

    // 保存终端列表
    await this.saveProjectTerminals(projectId)

    // 关闭所有终端和编辑器
    for (const item of tab.items) {
      if (item.type === 'terminal') {
        await this.closeSession(item.id)
      } else {
        this.closeEditor(item.id)
      }
    }

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
      console.log('[AppBusiness] After assignment, terminalFontSize:', this.terminalFontSize)
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

  // ============ 终端会话 ============
  async createSession(projectId: string | null, projectName: string | null, workingDir?: string): Promise<string> {
    const sessionId = await apiCreateTerminalSession(projectId, projectName, workingDir)
    const newSession: TerminalSession = {
      id: sessionId,
      projectId,
      projectName,
      workingDir: workingDir || '~',
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

  async closeSession(sessionId: string) {
    // 调用 API 关闭后端终端
    try {
      await apiCloseTerminalSession(sessionId)
    } catch { /* ignore */ }

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

    // 通知更新
    this.notifySessionsChange()
    this.notifyTabsChange()
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
    return sessionId
  }

  // ============ 终端列表保存/恢复 ============
  async saveProjectTerminals(projectId: string): Promise<void> {
    const project = this.projects.find(p => p.id === projectId)
    if (!project) return

    const projectSessions = this.sessions.filter(s => s.projectId === projectId)
    const terminals = projectSessions.map(s => ({ workingDir: s.workingDir }))

    try {
      await apiSaveTerminals(project.path, terminals)
      console.log('[Terminals] Saved terminals for project:', project.name, terminals)
    } catch (e) {
      console.error('[Terminals] Failed to save terminals:', e)
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
        await this.launchTerminal(projectId, project.name, terminal.workingDir)
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

    return id
  }

  closeEditor(editorId: string) {
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
    this.tabs = this.tabs.map(tab => {
      if (tab.projectId !== this.activeProjectId) return tab
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
}

// 单例 - 响应式
export const appBusiness = new AppBusinessClass()
