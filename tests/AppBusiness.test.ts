import { describe, it, expect, beforeEach, vi } from 'vitest'
import { appBusiness } from '../src/store/AppBusiness'

// Mock API functions - return unique session IDs each call
let sessionCallCount = 0
vi.mock('../src/api', () => ({
  createTerminalSession: vi.fn().mockImplementation(() => Promise.resolve(`session-mock-${++sessionCallCount}`)),
  closeTerminalSession: vi.fn().mockResolvedValue(undefined),
  listSessions: vi.fn().mockResolvedValue([]),
  terminalOutputListener: vi.fn().mockReturnValue(() => {}),
  terminalClosedListener: vi.fn().mockReturnValue(() => {}),
  terminalActivityListener: vi.fn().mockReturnValue(() => {}),
  stateChangedListener: vi.fn().mockReturnValue(() => {}),
  sessionsSnapshotListener: vi.fn().mockReturnValue(() => {}),
  terminalRenamedListener: vi.fn().mockReturnValue(() => {}),
  getProjects: vi.fn().mockResolvedValue([]),
  addProject: vi.fn().mockImplementation((name: string, path: string, group?: string) =>
    Promise.resolve({ id: `proj-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, path, group: group ?? null })
  ),
  removeProject: vi.fn().mockResolvedValue(undefined),
  renameProject: vi.fn().mockImplementation((id: string, newName: string) =>
    Promise.resolve({ id, name: newName, path: '' })
  ),
  getHomeDir: vi.fn().mockResolvedValue('/home/user'),
  getEditorPath: vi.fn().mockResolvedValue(null),
  setEditorPath: vi.fn().mockResolvedValue(undefined),
  getTerminalFontSize: vi.fn().mockResolvedValue(14),
  setTerminalFontSize: vi.fn().mockResolvedValue(undefined),
  saveTerminals: vi.fn().mockResolvedValue(undefined),
  loadTerminals: vi.fn().mockResolvedValue([]),
  clearTerminals: vi.fn().mockResolvedValue(undefined),
  saveEditors: vi.fn().mockResolvedValue(undefined),
  loadEditors: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  getFullState: vi.fn().mockResolvedValue({ projects: [], terminals: [], editors: [] }),
  updateFullState: vi.fn().mockResolvedValue(undefined),
  persistTerminal: vi.fn().mockResolvedValue(undefined),
  updatePersistedTerminal: vi.fn().mockResolvedValue(undefined),
  removePersistedTerminal: vi.fn().mockResolvedValue(undefined),
  updateEditors: vi.fn().mockResolvedValue(undefined),
  removeEditor: vi.fn().mockResolvedValue(undefined),
  clearAllState: vi.fn().mockResolvedValue({ success: true }),
  openProjectInEditor: vi.fn().mockResolvedValue(undefined),
  execCommand: vi.fn().mockResolvedValue({ success: true, output: '' }),
  killPort: vi.fn().mockResolvedValue('killed'),
  renameTerminal: vi.fn().mockResolvedValue({ success: true, name: '' }),
}))

describe('AppBusiness - 数据驱动UI', () => {
  beforeEach(() => {
    sessionCallCount = 0
    // 重置状态
    appBusiness.projects = []
    appBusiness.sessions = []
    appBusiness.editors = []
    appBusiness.activeIndex = -1
    appBusiness.activeEditorId = null
    appBusiness.activeProjectId = 'default'
    appBusiness.tabs = []
    appBusiness.sidebarCollapsed = false
    appBusiness.showSettings = false
  })

  describe('项目管理', () => {
    it('should add project', async () => {
      const project = await appBusiness.addProject('My Project', '/path/to/project')
      expect(project.id).toMatch(/^proj-/)
      expect(project.name).toBe('My Project')
      expect(project.path).toBe('/path/to/project')
      expect(appBusiness.projects.length).toBe(1)
    })

    it('should remove project', async () => {
      const project = await appBusiness.addProject('P1', '/path')
      await appBusiness.removeProject(project.id)
      expect(appBusiness.projects.length).toBe(0)
    })

    it('should rename project', async () => {
      const project = await appBusiness.addProject('P1', '/path')
      const updated = appBusiness.renameProject(project.id, 'New Name')
      expect(updated?.name).toBe('New Name')
    })
  })

  describe('项目Tab管理', () => {
    it('should ensure project tab exists', () => {
      const tab = appBusiness.ensureProjectTab('proj1', 'Project 1')
      expect(tab.projectId).toBe('proj1')
      expect(tab.projectName).toBe('Project 1')
      expect(tab.items).toEqual([])
      expect(tab.activeItemId).toBeNull()
    })

    it('should return existing tab', () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      const tab = appBusiness.ensureProjectTab('proj1', 'P1')
      expect(appBusiness.tabs.length).toBe(1)
    })

    it('should switch project tab', () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.ensureProjectTab('proj2', 'P2')
      appBusiness.switchProjectTab('proj2')
      expect(appBusiness.activeProjectId).toBe('proj2')
    })

    it('should close project tab', async () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      await appBusiness.closeProjectTab('proj1')
      expect(appBusiness.tabs.length).toBe(0)
    })

    it('should switch to first tab when closing active', async () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.ensureProjectTab('proj2', 'P2')
      appBusiness.activeProjectId = 'proj2'
      await appBusiness.closeProjectTab('proj2')
      expect(appBusiness.activeProjectId).toBe('proj1')
    })
  })

  describe('启动终端', () => {
    it('should launch terminal and create tab', async () => {
      await appBusiness.addProject('P1', '/path')
      const sessionId = await appBusiness.launchTerminal('proj1', 'P1', '/path')

      expect(sessionId).toMatch(/^session-/)
      expect(appBusiness.tabs.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
      expect(appBusiness.tabs[0].items[0].type).toBe('terminal')
      expect(appBusiness.tabs[0].activeItemId).toBe(sessionId)
    })

    it('should create separate terminals on each launchTerminal call', async () => {
      await appBusiness.addProject('P1', '/path')
      const id1 = await appBusiness.launchTerminal('proj1', 'P1', '/path')
      const id2 = await appBusiness.launchTerminal('proj1', 'P1', '/path')

      // Server-as-SSOT: launchTerminal always creates a new PTY on the server;
      // dedup is handled server-side via sessions_snapshot reconciliation.
      expect(id1).not.toBe(id2)
      expect(appBusiness.tabs[0].items.length).toBe(2)
    })

    it('should switch to project tab when launching', async () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'
      await appBusiness.addProject('P2', '/path2')
      await appBusiness.launchTerminal('proj2', 'P2')

      expect(appBusiness.activeProjectId).toBe('proj2')
    })
  })

  describe('编辑器', () => {
    it('should open editor and create tab item', async () => {
      await appBusiness.addProject('P1', '/path')
      const editorId = appBusiness.openEditor('proj1', 'P1', '/path/file.txt', 'content')

      expect(editorId).toMatch(/^editor-/)
      expect(appBusiness.editors.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
      expect(appBusiness.tabs[0].items[0].type).toBe('editor')
    })

    it('should not duplicate editor for same path', async () => {
      await appBusiness.addProject('P1', '/path')
      const id1 = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')
      const id2 = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')

      expect(id1).toBe(id2)
      expect(appBusiness.editors.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
    })

    it('should close editor from tab', async () => {
      await appBusiness.addProject('P1', '/path')
      const id = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')
      appBusiness.closeEditor(id)

      expect(appBusiness.editors.length).toBe(0)
      expect(appBusiness.tabs[0].items.length).toBe(0)
    })
  })

  describe('Getters', () => {
    it('should get currentTab', async () => {
      await appBusiness.addProject('P1', '/path')
      await appBusiness.launchTerminal('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'

      expect(appBusiness.currentTab?.projectId).toBe('proj1')
    })

    it('should get currentItems', async () => {
      await appBusiness.addProject('P1', '/path')
      await appBusiness.launchTerminal('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'

      const items = appBusiness.currentItems
      expect(items.length).toBe(1)
      expect(items[0].type).toBe('terminal')
    })

    it('should get currentActiveTerminalId', async () => {
      await appBusiness.addProject('P1', '/path')
      const id = await appBusiness.launchTerminal('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'

      expect(appBusiness.currentActiveTerminalId).toBe(id)
    })

    it('should get projectTabList', () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.ensureProjectTab('proj2', 'P2')

      expect(appBusiness.projectTabList).toEqual(['proj1', 'proj2'])
    })

    it('should get projectName', () => {
      appBusiness.ensureProjectTab('proj1', 'My Project')
      expect(appBusiness.getProjectName('proj1')).toBe('My Project')
    })
  })

  describe('Server-as-SSOT — sessions_snapshot', () => {
    it('onSessionsSnapshot replaces sessions atomically', () => {
      // 先本地创建一些 stale sessions
      appBusiness.sessions = [
        { id: 'stale-1', projectId: null, projectName: null, workingDir: '/tmp', name: 'T', alive: true, lastActivity: 0, children: [], activeSubId: null },
        { id: 'stale-2', projectId: null, projectName: null, workingDir: '/tmp', name: 'T', alive: true, lastActivity: 0, children: [], activeSubId: null },
      ]

      // 服务器广播权威快照（只含 fresh-1）
      appBusiness.onSessionsSnapshot([
        { id: 'fresh-1', projectId: 'proj1', projectName: 'P1', workingDir: '/home' },
      ])

      expect(appBusiness.sessions.length).toBe(1)
      expect(appBusiness.sessions[0].id).toBe('fresh-1')
      // stale sessions should be gone
      expect(appBusiness.sessions.find(s => s.id === 'stale-1')).toBeUndefined()
    })

    it('onSessionsSnapshot with empty array clears sessions', () => {
      appBusiness.sessions = [
        { id: 'old-1', projectId: null, projectName: null, workingDir: '/tmp', name: 'T', alive: true, lastActivity: 0, children: [], activeSubId: null },
      ]
      appBusiness.onSessionsSnapshot([])
      expect(appBusiness.sessions.length).toBe(0)
    })

    it('onSessionsSnapshot projects sessions into tabs (rebuildTabsFromSessions via snapshot)', () => {
      // Set up tab for proj1 (no items yet)
      appBusiness.ensureProjectTab('proj1', 'Project 1')

      // Server broadcasts snapshot with two sessions for proj1
      appBusiness.onSessionsSnapshot([
        { id: 's1', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
        { id: 's2', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
      ])

      const tab = appBusiness.tabs.find(t => t.projectId === 'proj1')
      expect(tab).toBeDefined()
      // Terminal items for both sessions should exist
      const terminalItems = tab!.items.filter(i => i.type === 'terminal')
      expect(terminalItems.length).toBe(2)
      expect(terminalItems.map(i => i.id)).toContain('s1')
      expect(terminalItems.map(i => i.id)).toContain('s2')
    })

    it('onSessionsSnapshot restores uiPrefs activeItemId after snapshot replace', () => {
      appBusiness.ensureProjectTab('proj1', 'Project 1')
      // First snapshot — two sessions, s1 active by default
      appBusiness.onSessionsSnapshot([
        { id: 's1', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
        { id: 's2', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
      ])

      // User selects s2
      appBusiness.selectItem('s2', 'terminal')

      // Second snapshot (e.g., after rename) — same sessions, snapshot replace runs
      appBusiness.onSessionsSnapshot([
        { id: 's1', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
        { id: 's2', projectId: 'proj1', projectName: 'Project 1', workingDir: '/proj1' },
      ])

      const tab = appBusiness.tabs.find(t => t.projectId === 'proj1')
      // Should restore s2 as active from uiPrefs
      expect(tab?.activeItemId).toBe('s2')
    })
  })

  describe('closeSession — optimistic UI', () => {
    it('removes session from tabs immediately (before API response)', async () => {
      // Setup: one project tab with one terminal
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.sessions = [
        { id: 'sess-1', projectId: 'proj1', projectName: 'P1', workingDir: '/p', name: 'T', alive: true, lastActivity: 0, children: [], activeSubId: null }
      ]
      appBusiness.tabs = [{
        projectId: 'proj1',
        projectName: 'P1',
        items: [{ id: 'sess-1', type: 'terminal', name: 'Terminal' }],
        activeItemId: 'sess-1'
      }]

      // Start closeSession (don't await yet — check optimistic update)
      const closePromise = appBusiness.closeSession('sess-1')

      // The session should be gone from local state immediately (synchronous optimistic update)
      expect(appBusiness.sessions.find(s => s.id === 'sess-1')).toBeUndefined()
      expect(appBusiness.tabs[0].items.find(i => i.id === 'sess-1')).toBeUndefined()

      // Await to let the async API call resolve cleanly
      await closePromise
    })

    it('updates activeItemId when closing active terminal', async () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.sessions = [
        { id: 's1', projectId: 'proj1', projectName: 'P1', workingDir: '/p', name: 'T1', alive: true, lastActivity: 0, children: [], activeSubId: null },
        { id: 's2', projectId: 'proj1', projectName: 'P1', workingDir: '/p', name: 'T2', alive: true, lastActivity: 0, children: [], activeSubId: null },
      ]
      appBusiness.tabs = [{
        projectId: 'proj1',
        projectName: 'P1',
        items: [
          { id: 's1', type: 'terminal', name: 'T1' },
          { id: 's2', type: 'terminal', name: 'T2' },
        ],
        activeItemId: 's1'  // s1 is active
      }]

      await appBusiness.closeSession('s1')

      const tab = appBusiness.tabs[0]
      // s1 gone, s2 should become active
      expect(tab.items.find(i => i.id === 's1')).toBeUndefined()
      expect(tab.activeItemId).toBe('s2')
    })
  })

  describe('完整工作流 - 两个项目', () => {
    it('should handle two projects with terminals', async () => {
      // 添加两个项目
      const p1 = await appBusiness.addProject('Project 1', '/path1')
      const p2 = await appBusiness.addProject('Project 2', '/path2')

      // 项目1启动终端
      const t1 = await appBusiness.launchTerminal(p1.id, p1.name, p1.path)

      // 项目2启动终端
      const t2 = await appBusiness.launchTerminal(p2.id, p2.name, p2.path)

      expect(appBusiness.projects.length).toBe(2)
      expect(appBusiness.tabs.length).toBe(2)

      // 每个项目有1个tab items
      expect(appBusiness.tabs[0].items.length).toBe(1)
      expect(appBusiness.tabs[0].items[0].type).toBe('terminal')

      expect(appBusiness.tabs[1].items.length).toBe(1)

      // 切换项目1
      appBusiness.switchProjectTab(p1.id)
      expect(appBusiness.activeProjectId).toBe(p1.id)
      expect(appBusiness.currentItems.length).toBe(1)

      // 切换项目2
      appBusiness.switchProjectTab(p2.id)
      expect(appBusiness.activeProjectId).toBe(p2.id)
      expect(appBusiness.currentItems.length).toBe(1)
    })

    it('should handle two projects with terminal and editor', async () => {
      // 添加两个项目
      const p1 = await appBusiness.addProject('Project 1', '/path1')
      const p2 = await appBusiness.addProject('Project 2', '/path2')

      // 项目1：终端 + 编辑器
      await appBusiness.launchTerminal(p1.id, p1.name, p1.path)
      appBusiness.openEditor(p1.id, p1.name, '/path1/file.txt', 'content1')

      // 项目2：终端 + 编辑器
      await appBusiness.launchTerminal(p2.id, p2.name, p2.path)
      appBusiness.openEditor(p2.id, p2.name, '/path2/file.txt', 'content2')

      expect(appBusiness.tabs.length).toBe(2)

      // 项目1的tab
      expect(appBusiness.tabs[0].items.length).toBe(2)
      expect(appBusiness.tabs[0].items.filter(i => i.type === 'terminal').length).toBe(1)
      expect(appBusiness.tabs[0].items.filter(i => i.type === 'editor').length).toBe(1)

      // 项目2的tab
      expect(appBusiness.tabs[1].items.length).toBe(2)
      expect(appBusiness.tabs[1].items.filter(i => i.type === 'terminal').length).toBe(1)
      expect(appBusiness.tabs[1].items.filter(i => i.type === 'editor').length).toBe(1)

      // 切换项目1
      appBusiness.switchProjectTab(p1.id)
      expect(appBusiness.currentItems.length).toBe(2)
      expect(appBusiness.currentItems.filter(i => i.type === 'editor')[0].path).toBe('/path1/file.txt')

      // 切换项目2
      appBusiness.switchProjectTab(p2.id)
      expect(appBusiness.currentItems.filter(i => i.type === 'editor')[0].path).toBe('/path2/file.txt')
    })
  })
})
