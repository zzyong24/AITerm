import { app, BrowserWindow, ipcMain, Menu, dialog, shell } from 'electron'
import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync } from 'fs'

const WEB_PORT = 5003

// 日志
let log: any = null

// 服务实例
let ptyService: any = null
let projectService: any = null
let fileService: any = null
let gitService: any = null
let dbService: any = null

let mainWindow: BrowserWindow | null = null

// 动态导入 ESM 模块（绕过 TypeScript CommonJS 编译限制）
const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<any>

// 加载服务
async function loadServices() {
  const electronLog = await import('electron-log')
  log = electronLog.default || electronLog
  log.transports.file.level = 'info'
  log.info('Application starting...')

  const servicesPath = join(app.getAppPath(), 'server/services')

  const { PtyService } = await dynamicImport(join(servicesPath, 'PtyService.mjs'))
  const { ProjectService } = await dynamicImport(join(servicesPath, 'ProjectService.mjs'))
  const { FileService } = await dynamicImport(join(servicesPath, 'FileService.mjs'))
  const { DatabaseService, getDatabaseService } = await dynamicImport(join(servicesPath, 'DatabaseService.mjs'))
  const { GitService } = await import('../shared/services/GitService')

  ptyService = new PtyService()
  projectService = new ProjectService()
  fileService = new FileService()
  gitService = new GitService()
  dbService = getDatabaseService()

  // 设置 GitService 日志处理器
  gitService.setLogger((msg: string) => log.info(msg))

  // 设置 FileService watcher 回调，转发事件到渲染进程
  fileService.setWatcherCallback((type: string, data: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(`watcher-${type}`, data)
    }
  })

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
  } else if (embeddedServer) {
    mainWindow.loadURL(`http://localhost:${WEB_PORT}`)
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  log.info('Main window created')

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error('Failed to load:', errorCode, errorDescription)
  })
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
    console.log('[Main] close-terminal-session IPC received', { sessionId })
    await ptyService.close(sessionId)
    console.log('[Main] close-terminal-session completed', { sessionId })
  })

  ipcMain.handle('list-sessions', async () => {
    return ptyService.listSessions()
  })

  ipcMain.handle('get-open-terminals-count', async () => {
    const sessions = ptyService.listSessions()
    return sessions.length
  })

  // 项目相关
  ipcMain.handle('get-projects', async () => {
    const projects = projectService.getProjects()
    // 附加 git 摘要
    const result = await Promise.all(projects.map(async (p: { id: string; name: string; path: string; group?: string }) => {
      const brief = await gitService.getStatusBrief(p.path)
      return { ...p, git: brief }
    }))
    return result
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

  ipcMain.handle('get-terminal-font-size', async () => {
    return projectService.getTerminalFontSize()
  })

  ipcMain.handle('set-terminal-font-size', async (_, fontSize: number) => {
    await projectService.setTerminalFontSize(fontSize)
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

  ipcMain.handle('is-git-ignored', async (_, path: string) => {
    return fileService.isGitIgnored(path)
  })

  // 文件监听相关
  ipcMain.handle('start-watcher', async (_, projectPath: string, rootPath: string) => {
    fileService.startWatcher(projectPath, rootPath)
  })

  ipcMain.handle('stop-watcher', async (_, projectPath: string) => {
    fileService.stopWatcher(projectPath)
  })

  ipcMain.handle('stop-all-watchers', async () => {
    fileService.stopAllWatchers()
  })

  ipcMain.handle('get-watcher-info', async () => {
    return fileService.getWatcherInfo()
  })

  // 搜索相关
  ipcMain.handle('search-in-directory', async (_, dirPath: string, query: string) => {
    return await fileService.searchInDirectory(dirPath, query)
  })

  ipcMain.handle('search-file-content', async (_, dirPath: string, query: string, maxResults: number = 200, extensions?: string) => {
    return await fileService.searchFileContent(dirPath, query, maxResults, extensions)
  })

  ipcMain.handle('exec-command', async (_, command: string, cwd: string) => {
    return fileService.execCommand(command, cwd)
  })

  // Git 相关
  ipcMain.handle('get-git-status', async (_, path: string) => {
    return await gitService.getStatus(path)
  })

  ipcMain.handle('get-git-repo-brief', async (_, path: string) => {
    return await gitService.getStatusBrief(path)
  })

  ipcMain.handle('get-git-remote', async (_, path: string) => {
    return await gitService.getRemote(path)
  })

  ipcMain.handle('get-git-last-commit', async (_, path: string) => {
    return await gitService.getLastCommit(path)
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

  ipcMain.handle('git-commit', async (_, repoPath: string, message: string, files: string[] = []) => {
    return await gitService.commit(repoPath, message, files)
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

  // 跨端持久化 API（SQLite）
  ipcMain.handle('get-full-state', async () => {
    return dbService.getFullState()
  })

  ipcMain.handle('update-full-state', async (_, state: any) => {
    const { projects, terminals, editors } = state

    // 更新 projects
    if (projects && Array.isArray(projects)) {
      for (const p of projects) {
        const existing = dbService.getProject(p.id)
        if (existing) {
          const stmt = dbService.db.prepare('UPDATE projects SET name = ?, path = ?, "order" = ? WHERE id = ?')
          stmt.run(p.name, p.path, p.order || 0, p.id)
        } else {
          dbService.addProject(p.id, p.name, p.path, p.order || 0)
        }
      }
    }

    // 更新 terminals
    if (terminals && Array.isArray(terminals)) {
      for (const t of terminals) {
        const existing = dbService.getTerminal(t.id)
        if (existing) {
          dbService.updateTerminal(t.id, t)
        } else {
          dbService.addTerminal(t.id, t.name, t.cwd, t.taskSlug || null)
        }
      }
    }

    // 更新 editors
    if (editors && Array.isArray(editors)) {
      for (const e of editors) {
        dbService.saveEditor(e.projectId, e.id, e.path, e.name, e.scrollToLine)
      }
    }

    return { success: true }
  })

  ipcMain.handle('persist-terminal', async (_, id: string, name: string, cwd: string, taskSlug?: string) => {
    return dbService.addTerminal(id, name, cwd, taskSlug)
  })

  ipcMain.handle('update-persisted-terminal', async (_, id: string, updates: any) => {
    dbService.updateTerminal(id, updates)
    return { success: true }
  })

  ipcMain.handle('remove-persisted-terminal', async (_, id: string) => {
    dbService.removeTerminal(id)
    return { success: true }
  })

  ipcMain.handle('update-editors', async (_, editors: any[]) => {
    for (const e of editors) {
      dbService.saveEditor(e.projectId, e.id, e.path, e.name, e.scrollToLine)
    }
    return { success: true }
  })

  ipcMain.handle('remove-editor', async (_, projectId: string, id: string) => {
    dbService.removeEditor(projectId, id)
    return { success: true }
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

// 内嵌 Web 服务器
let embeddedServer: any = null
let wss: any = null

function startEmbeddedServer() {
  return new Promise((resolve, reject) => {
    const distPath = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'dist')
      : join(__dirname, '../dist')

    const indexPath = join(distPath, 'index.html')

    if (!existsSync(indexPath)) {
      console.warn('[EmbeddedServer] dist/index.html not found, skipping web server')
      log.warn('[EmbeddedServer] indexPath checked:', indexPath, 'exists:', existsSync(indexPath))
      resolve(null)
      return
    }

    log.info('[EmbeddedServer] Serving files from:', distPath)

    const expressApp = express()
    expressApp.use(cors())

    // 提供静态文件
    expressApp.use(express.static(distPath))

    // SPA fallback
    expressApp.get('*', (req, res) => {
      res.sendFile(indexPath)
    })

    embeddedServer = expressApp.listen(WEB_PORT, () => {
      console.log(`[EmbeddedServer] Running on http://localhost:${WEB_PORT}`)
      resolve(embeddedServer)
    })

    embeddedServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[EmbeddedServer] Port ${WEB_PORT} already in use, skipping web server`)
        resolve(null)
      } else {
        reject(err)
      }
    })
  })
}

function stopEmbeddedServer() {
  return new Promise((resolve) => {
    if (embeddedServer) {
      embeddedServer.close(() => {
        console.log('[EmbeddedServer] Stopped')
        embeddedServer = null
        resolve(null)
      })
    } else {
      resolve(null)
    }
  })
}

app.whenReady().then(async () => {
  await loadServices()
  await startEmbeddedServer()
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

app.on('before-quit', async (e) => {
  // 等待所有 PTY 会话关闭完成后再退出
  e.preventDefault()
  try {
    await ptyService?.closeAll()
    await stopEmbeddedServer()
  } catch (err) {
    log?.error('Error closing services:', err)
  }
  log?.info('All services closed, proceeding with quit')
  app.exit(0)
})
