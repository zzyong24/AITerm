import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron'
import { join } from 'path'

// 日志
let log: any = null

// 服务实例
let ptyService: any = null
let projectService: any = null
let fileService: any = null
let gitService: any = null

let mainWindow: BrowserWindow | null = null

// 加载服务
async function loadServices() {
  const electronLog = await import('electron-log')
  log = electronLog.default || electronLog
  log.transports.file.level = 'info'
  log.info('Application starting...')

  const { PtyService } = await import('./services/PtyService')
  const { ProjectService } = await import('./services/ProjectService')
  const { FileService } = await import('./services/FileService')
  const { GitService } = await import('./services/GitService')

  ptyService = new PtyService()
  projectService = new ProjectService()
  fileService = new FileService()
  gitService = new GitService()

  // 终端事件转发到渲染进程
  ptyService.on('output', (data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-output', data)
    }
  })

  ptyService.on('closed', (data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-closed', data)
    }
  })

  ptyService.on('activity', (data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-activity', data)
    }
  })

  log.info('Services loaded')
}

// 全局异常处理
process.on('uncaughtException', (error) => {
  log?.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  log?.error('Unhandled Rejection:', reason)
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AITerm',
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 创建菜单
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'AITerm',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log.info('Main window created')
}

// 注册 IPC handlers
function registerIpcHandlers() {
  // 终端相关
  ipcMain.handle('create-terminal-session', async (_, projectId, projectName, workingDir) => {
    return await ptyService.createSession(projectId, projectName, workingDir)
  })

  ipcMain.handle('write-to-terminal', async (_, sessionId: string, data: string) => {
    ptyService.write(sessionId, data)
  })

  ipcMain.handle('resize-terminal', async (_, sessionId: string, rows: number, cols: number) => {
    ptyService.resize(sessionId, rows, cols)
  })

  ipcMain.handle('close-terminal-session', async (_, sessionId: string) => {
    await ptyService.close(sessionId)
  })

  ipcMain.handle('list-sessions', async () => {
    return ptyService.listSessions()
  })

  // 项目相关
  ipcMain.handle('get-projects', async () => {
    return projectService.getProjects()
  })

  ipcMain.handle('add-project', async (_, name: string, path: string, group?: string) => {
    return projectService.addProject(name, path, group)
  })

  ipcMain.handle('remove-project', async (_, id: string) => {
    await projectService.removeProject(id)
  })

  ipcMain.handle('rename-project', async (_, id: string, newName: string) => {
    return projectService.renameProject(id, newName)
  })

  // 设置相关
  ipcMain.handle('get-editor-path', async () => {
    return projectService.getEditorPath()
  })

  ipcMain.handle('set-editor-path', async (_, editorPath: string | null) => {
    await projectService.setEditorPath(editorPath)
  })

  ipcMain.handle('open-project-in-editor', async (_, projectPath: string) => {
    await projectService.openInEditor(projectPath)
  })

  // 目录选择
  ipcMain.handle('pick-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择项目目录'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // 文件操作
  ipcMain.handle('get-home-dir', async () => {
    return fileService.getHomeDir()
  })

  ipcMain.handle('read-directory', async (_, path: string, showHidden: boolean) => {
    return await fileService.readDirectory(path, showHidden)
  })

  ipcMain.handle('read-directory-batch', async (_, path: string, showHidden: boolean) => {
    return await fileService.readDirectoryBatch(path, showHidden)
  })

  ipcMain.handle('is-directory', async (_, path: string) => {
    return fileService.isDirectory(path)
  })

  ipcMain.handle('delete-path', async (_, path: string) => {
    await fileService.deletePath(path)
  })

  ipcMain.handle('read-file', async (_, path: string) => {
    return await fileService.readFile(path)
  })

  ipcMain.handle('write-file', async (_, path: string, content: string) => {
    await fileService.writeFile(path, content)
  })

  ipcMain.handle('paste-file', async (_, targetDir: string, clipboardPath: string) => {
    await fileService.pasteFile(targetDir, clipboardPath)
  })

  ipcMain.handle('kill-port', async (_, port: number) => {
    return await fileService.killPort(port)
  })

  // 终端历史
  ipcMain.handle('save-terminal-history', async (_, projectPath: string, workingDir: string, entries: any[]) => {
    fileService.saveTerminalHistory(projectPath, workingDir, entries)
  })

  ipcMain.handle('load-terminal-history', async (_, projectPath: string, workingDir: string) => {
    return fileService.loadTerminalHistory(projectPath, workingDir)
  })

  ipcMain.handle('clear-terminal-history', async (_, projectPath: string, workingDir: string) => {
    fileService.clearTerminalHistory(projectPath, workingDir)
  })

  // 终端列表保存/恢复
  ipcMain.handle('save-terminals', async (_, projectPath: string, terminals: { workingDir: string }[]) => {
    fileService.saveTerminals(projectPath, terminals)
  })

  ipcMain.handle('load-terminals', async (_, projectPath: string) => {
    return fileService.loadTerminals(projectPath)
  })

  ipcMain.handle('clear-terminals', async (_, projectPath: string) => {
    fileService.clearTerminals(projectPath)
  })

  ipcMain.handle('is-git-ignored', async (_, path: string) => {
    return fileService.isGitIgnored(path)
  })

  // 搜索相关
  ipcMain.handle('search-in-directory', async (_, dirPath: string, query: string) => {
    return await fileService.searchInDirectory(dirPath, query)
  })

  ipcMain.handle('search-file-content', async (_, dirPath: string, query: string) => {
    return await fileService.searchFileContent(dirPath, query)
  })

  // Git 相关
  ipcMain.handle('get-git-status', async (_, path: string) => {
    return await gitService.getStatus(path)
  })

  ipcMain.handle('git-stage-file', async (_, repoPath: string, filePath: string) => {
    return await gitService.stageFile(repoPath, filePath)
  })

  ipcMain.handle('git-stage-all', async (_, repoPath: string) => {
    return await gitService.stageAll(repoPath)
  })

  ipcMain.handle('git-unstage-file', async (_, repoPath: string, filePath: string) => {
    return await gitService.unstageFile(repoPath, filePath)
  })

  ipcMain.handle('git-commit', async (_, repoPath: string, message: string) => {
    return await gitService.commit(repoPath, message)
  })

  ipcMain.handle('git-push', async (_, repoPath: string) => {
    return await gitService.push(repoPath)
  })

  ipcMain.handle('git-pull', async (_, repoPath: string) => {
    return await gitService.pull(repoPath)
  })

  ipcMain.handle('git-discard-changes', async (_, repoPath: string, filePath: string) => {
    return await gitService.discardChanges(repoPath, filePath)
  })

  // 窗口控制
  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window-close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() || false
  })

  ipcMain.handle('window-set-fullscreen', (_, flag: boolean) => {
    mainWindow?.setFullScreen(flag)
  })

  ipcMain.handle('window-is-fullscreen', () => {
    return mainWindow?.isFullScreen() || false
  })

  ipcMain.handle('window-toggle-fullscreen', () => {
    if (mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false)
    } else {
      mainWindow?.setFullScreen(true)
    }
  })

  // 外部链接
  ipcMain.handle('open-external', async (_, url: string) => {
    await shell.openExternal(url)
  })

  log.info('IPC handlers registered')
}

app.whenReady().then(async () => {
  await loadServices()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ptyService?.closeAll()
})
