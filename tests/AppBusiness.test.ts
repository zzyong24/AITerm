import { describe, it, expect, beforeEach, vi } from 'vitest'
import { appBusiness } from '../src/store/AppBusiness'

// Mock API functions - return unique session IDs each call
let sessionCallCount = 0
vi.mock('../src/api', () => ({
  createTerminalSession: vi.fn().mockImplementation(() => Promise.resolve(`session-mock-${++sessionCallCount}`)),
  closeTerminalSession: vi.fn().mockResolvedValue(undefined),
  terminalOutputListener: vi.fn().mockReturnValue(() => {}),
  terminalClosedListener: vi.fn().mockReturnValue(() => {}),
  terminalActivityListener: vi.fn().mockReturnValue(() => {})
}))

describe('AppBusiness - 数据驱动UI', () => {
  beforeEach(() => {
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
    it('should add project', () => {
      const project = appBusiness.addProject('My Project', '/path/to/project')
      expect(project.id).toMatch(/^proj-/)
      expect(project.name).toBe('My Project')
      expect(project.path).toBe('/path/to/project')
      expect(appBusiness.projects.length).toBe(1)
    })

    it('should remove project', () => {
      const project = appBusiness.addProject('P1', '/path')
      appBusiness.removeProject(project.id)
      expect(appBusiness.projects.length).toBe(0)
    })

    it('should rename project', () => {
      const project = appBusiness.addProject('P1', '/path')
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
      appBusiness.addProject('P1', '/path')
      const sessionId = await appBusiness.launchTerminal('proj1', 'P1', '/path')

      expect(sessionId).toMatch(/^session-/)
      expect(appBusiness.tabs.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
      expect(appBusiness.tabs[0].items[0].type).toBe('terminal')
      expect(appBusiness.tabs[0].activeItemId).toBe(sessionId)
    })

    it('should not create duplicate terminal', async () => {
      appBusiness.addProject('P1', '/path')
      const id1 = await appBusiness.launchTerminal('proj1', 'P1', '/path')
      const id2 = await appBusiness.launchTerminal('proj1', 'P1', '/path')

      expect(id1).toBe(id2)
      expect(appBusiness.tabs[0].items.length).toBe(1)
    })

    it('should switch to project tab when launching', async () => {
      appBusiness.ensureProjectTab('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'
      appBusiness.addProject('P2', '/path2')
      await appBusiness.launchTerminal('proj2', 'P2')

      expect(appBusiness.activeProjectId).toBe('proj2')
    })
  })

  describe('编辑器', () => {
    it('should open editor and create tab item', () => {
      appBusiness.addProject('P1', '/path')
      const editorId = appBusiness.openEditor('proj1', 'P1', '/path/file.txt', 'content')

      expect(editorId).toMatch(/^editor-/)
      expect(appBusiness.editors.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
      expect(appBusiness.tabs[0].items[0].type).toBe('editor')
    })

    it('should not duplicate editor for same path', () => {
      appBusiness.addProject('P1', '/path')
      const id1 = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')
      const id2 = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')

      expect(id1).toBe(id2)
      expect(appBusiness.editors.length).toBe(1)
      expect(appBusiness.tabs[0].items.length).toBe(1)
    })

    it('should close editor from tab', () => {
      appBusiness.addProject('P1', '/path')
      const id = appBusiness.openEditor('proj1', 'P1', '/path/file.txt')
      appBusiness.closeEditor(id)

      expect(appBusiness.editors.length).toBe(0)
      expect(appBusiness.tabs[0].items.length).toBe(0)
    })
  })

  describe('Getters', () => {
    it('should get currentTab', async () => {
      appBusiness.addProject('P1', '/path')
      await appBusiness.launchTerminal('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'

      expect(appBusiness.currentTab?.projectId).toBe('proj1')
    })

    it('should get currentItems', async () => {
      appBusiness.addProject('P1', '/path')
      await appBusiness.launchTerminal('proj1', 'P1')
      appBusiness.activeProjectId = 'proj1'

      const items = appBusiness.currentItems
      expect(items.length).toBe(1)
      expect(items[0].type).toBe('terminal')
    })

    it('should get currentActiveTerminalId', async () => {
      appBusiness.addProject('P1', '/path')
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

  describe('完整工作流 - 两个项目', () => {
    it('should handle two projects with terminals', async () => {
      // 添加两个项目
      const p1 = appBusiness.addProject('Project 1', '/path1')
      const p2 = appBusiness.addProject('Project 2', '/path2')

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
      const p1 = appBusiness.addProject('Project 1', '/path1')
      const p2 = appBusiness.addProject('Project 2', '/path2')

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
