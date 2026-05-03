import { WebSocketServer } from 'ws'
import express from 'express'

/**
 * 注册所有 API 路由和 WebSocket
 * @param {import('express').Application} app - Express 应用
 * @param {Object} services - 服务实例 { ptyService, projectService, fileService, gitService, dbService }
 * @param {Object} options - 配置选项 { port, enableWs }
 */
export function registerRoutes(app, services, options = {}) {
  const { ptyService, projectService, fileService, gitService, dbService } = services
  const port = options.port || 5001
  const enableWs = options.enableWs !== false

  // ========== 中间件 ==========
  app.use(express.json())

  // ========== 终端相关 API ==========
  app.post('/api/terminals', async (req, res) => {
    try {
      const { projectId, projectName, workingDir } = req.body
      const sessionId = await ptyService.createSession(projectId, projectName, workingDir)
      res.json({ sessionId })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/terminals/:id/rename', (req, res) => {
    try {
      const { id } = req.params
      const { name } = req.body
      const validName = String(name).replace(/[^\w\u4e00-\u9fa5\-_]/g, '')
      const message = JSON.stringify({ type: 'terminal-renamed', sessionId: id, name: validName })
      broadcastToWs(message)
      res.json({ success: true, name: validName })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/terminals/:id/write', (req, res) => {
    const { id } = req.params
    const { data } = req.body
    ptyService.write(id, data)
    res.json({ success: true })
  })

  app.post('/api/terminals/:id/resize', (req, res) => {
    const { id } = req.params
    const { rows, cols } = req.body
    ptyService.resize(id, rows, cols)
    res.json({ success: true })
  })

  app.delete('/api/terminals/:id', async (req, res) => {
    try {
      const { id } = req.params
      await ptyService.close(id)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/terminals', (_, res) => {
    res.json(ptyService.listSessions())
  })

  // ========== 项目相关 API ==========
  app.get('/api/projects', async (_, res) => {
    try {
      const projects = projectService.getProjects()
      const result = await Promise.all(projects.map(async (p) => {
        const brief = await gitService.getStatusBrief(p.path)
        return { ...p, git: brief }
      }))
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/projects', (req, res) => {
    try {
      const { name, path, group } = req.body
      const project = projectService.addProject(name, path, group)
      res.json(project)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const { id } = req.params
      await projectService.removeProject(id)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.patch('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params
      const { newName } = req.body
      const project = projectService.renameProject(id, newName)
      res.json(project)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ========== 设置相关 API ==========
  app.get('/api/settings/editor', (_, res) => {
    res.json({ editorPath: projectService.getEditorPath() })
  })

  app.post('/api/settings/editor', (req, res) => {
    const { editorPath } = req.body
    projectService.setEditorPath(editorPath)
    res.json({ success: true })
  })

  app.get('/api/settings/terminal-font-size', (_, res) => {
    res.json({ fontSize: projectService.getTerminalFontSize() })
  })

  app.post('/api/settings/terminal-font-size', (req, res) => {
    const { fontSize } = req.body
    projectService.setTerminalFontSize(fontSize)
    res.json({ success: true })
  })

  app.post('/api/open-in-editor', async (req, res) => {
    try {
      const { projectPath } = req.body
      await projectService.openInEditor(projectPath)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/pick-directory', (_, res) => {
    res.json(null)
  })

  // ========== 文件操作 API ==========
  app.get('/api/home-dir', (_, res) => {
    res.json(fileService.getHomeDir())
  })

  app.get('/api/directory', async (req, res) => {
    try {
      const { path, showHidden } = req.query
      const entries = await fileService.readDirectory(path, showHidden === 'true')
      res.json(entries)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/directory-batch', async (req, res) => {
    try {
      const { path, showHidden } = req.body
      const entries = await fileService.readDirectoryBatch(path, showHidden)
      res.json(entries)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/is-directory', (req, res) => {
    const { path } = req.query
    res.json(fileService.isDirectory(path))
  })

  app.delete('/api/path', async (req, res) => {
    try {
      const { path } = req.body
      await fileService.deletePath(path)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/file', async (req, res) => {
    try {
      const { path } = req.query
      const content = await fileService.readFile(path)
      res.json(content)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/file', async (req, res) => {
    try {
      const { path, content } = req.body
      await fileService.writeFile(path, content)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/paste-file', async (req, res) => {
    try {
      const { targetDir, clipboardPath } = req.body
      await fileService.pasteFile(targetDir, clipboardPath)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/kill-port', async (req, res) => {
    try {
      const { port: killPort } = req.body
      const result = await fileService.killPort(killPort)
      res.json({ result })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/save-terminal-history', async (req, res) => {
    try {
      const { projectPath, workingDir, entries } = req.body
      fileService.saveTerminalHistory(projectPath, workingDir, entries)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/load-terminal-history', async (req, res) => {
    try {
      const { projectPath, workingDir } = req.query
      const entries = fileService.loadTerminalHistory(projectPath, workingDir)
      res.json(entries)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/clear-terminal-history', async (req, res) => {
    try {
      const { projectPath, workingDir } = req.body
      fileService.clearTerminalHistory(projectPath, workingDir)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/save-terminals', async (req, res) => {
    try {
      const { projectPath, terminals } = req.body
      fileService.saveTerminals(projectPath, terminals)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/load-terminals', async (req, res) => {
    try {
      const { projectPath } = req.query
      const terminals = fileService.loadTerminals(projectPath)
      res.json(terminals)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/api/terminals', async (req, res) => {
    try {
      const { projectPath } = req.body
      fileService.clearTerminals(projectPath)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/save-editors', async (req, res) => {
    try {
      const { projectPath, editors } = req.body
      // 编辑器持久化已迁移到 SQLite，通过 IPC API 处理
      // 这里仅作日志记录，不再写入 FileService
      console.log('[Server] save-editors called (now handled via IPC/SQLite):', projectPath, editors?.length)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/load-editors', async (req, res) => {
    try {
      const { projectPath } = req.query
      // 通过 projectPath 查找 projectId，再从 SQLite 获取 editors
      const project = projectService.getProjects().find(p => p.path === projectPath)
      if (project) {
        const editors = dbService.getEditorsByProject(project.id)
        res.json(editors)
      } else {
        res.json([])
      }
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/is-git-ignored', async (req, res) => {
    try {
      const { path } = req.body
      const result = fileService.isGitIgnored(path)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/exec', async (req, res) => {
    try {
      const { command, cwd } = req.body
      const result = fileService.execCommand(command, cwd)
      res.json(result)
    } catch (e) {
      res.status(500).json({ success: false, error: e.message })
    }
  })

  // ========== 搜索 API ==========
  app.post('/api/search-in-directory', async (req, res) => {
    try {
      const { dirPath, query } = req.body
      const results = await fileService.searchInDirectory(dirPath, query)
      res.json(results)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/search-file-content', async (req, res) => {
    try {
      const { dirPath, query, maxResults, extensions } = req.body
      console.log('[Server] searchFileContent:', { dirPath, query, maxResults, extensions })
      const results = await fileService.searchFileContent(dirPath, query, maxResults, extensions)
      console.log('[Server] search results count:', results.length)
      res.json(results)
    } catch (e) {
      console.error('[Server] search error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // ========== Git API ==========
  app.get('/api/git-status', async (req, res) => {
    try {
      const { path } = req.query
      const status = await gitService.getStatus(path)
      res.json(status)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/git-repo-brief', async (req, res) => {
    try {
      const { path } = req.query
      const brief = await gitService.getStatusBrief(path)
      res.json(brief)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/git-remote', async (req, res) => {
    try {
      const { path } = req.query
      const remote = await gitService.getRemote(path)
      res.json(remote)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/git-last-commit', async (req, res) => {
    try {
      const { path } = req.query
      const commit = await gitService.getLastCommit(path)
      res.json(commit)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-stage-all', async (req, res) => {
    try {
      const { repoPath } = req.body
      const result = await gitService.stageAll(repoPath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-stage-file', async (req, res) => {
    try {
      const { repoPath, filePath } = req.body
      const result = await gitService.stageFile(repoPath, filePath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-commit', async (req, res) => {
    try {
      const { repoPath, message, files } = req.body
      const result = await gitService.commit(repoPath, message, files)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-push', async (req, res) => {
    try {
      const { repoPath } = req.body
      const result = await gitService.push(repoPath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-pull', async (req, res) => {
    try {
      const { repoPath } = req.body
      const result = await gitService.pull(repoPath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-unstage-file', async (req, res) => {
    try {
      const { repoPath, filePath } = req.body
      const result = await gitService.unstageFile(repoPath, filePath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/git-discard-changes', async (req, res) => {
    try {
      const { repoPath, filePath } = req.body
      const result = await gitService.discardChanges(repoPath, filePath)
      res.json(result)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ========== 跨端持久化 API（SQLite） ==========
  app.get('/api/state', (req, res) => {
    try {
      const state = dbService.getFullState()
      res.json(state)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.put('/api/state', (req, res) => {
    try {
      const { projects, terminals, editors } = req.body
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
      if (terminals && Array.isArray(terminals)) {
        const currentTerminals = dbService.getAllTerminals()
        for (const t of currentTerminals) {
          dbService.removeTerminal(t.id)
        }
        for (const t of terminals) {
          dbService.addTerminal(t.id, t.name, t.cwd || '', t.taskSlug || null, t.projectId || null)
        }
      }
      if (editors && Array.isArray(editors)) {
        for (const e of editors) {
          dbService.saveEditor(e.projectId, e.id, e.path, e.name, e.scrollToLine)
        }
      }
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/persist/terminals', (req, res) => {
    try {
      const { id, name, cwd, taskSlug, projectId } = req.body
      const terminal = dbService.addTerminal(id, name, cwd, taskSlug, projectId)
      res.json(terminal)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.put('/api/terminals/:id', (req, res) => {
    try {
      const { id } = req.params
      const updates = req.body
      dbService.updateTerminal(id, updates)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/api/persist/terminals/:id', (req, res) => {
    try {
      const { id } = req.params
      dbService.removeTerminal(id)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.put('/api/editors', (req, res) => {
    try {
      const { projectId, editors } = req.body
      if (Array.isArray(editors)) {
        for (const e of editors) {
          dbService.saveEditor(projectId || e.projectId, e.id, e.path, e.name, e.scrollToLine)
        }
      }
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.delete('/api/editors/:projectId/:id', (req, res) => {
    try {
      const { projectId, id } = req.params
      dbService.removeEditor(projectId, id)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ========== WebSocket ==========
  let wss = null

  if (enableWs) {
    wss = new WebSocketServer({ port: port + 1 })

    wss.on('connection', (ws) => {
      console.log('WebSocket client connected')
      ws.on('message', (message) => {
        // 处理客户端消息
      })
      ws.on('close', () => {
        console.log('WebSocket client disconnected')
      })
    })

    // 转发终端输出到 WebSocket 客户端
    ptyService.on('output', (data) => {
      const message = JSON.stringify({ type: 'output', ...data })
      broadcastToWs(message)
    })

    ptyService.on('closed', (data) => {
      const message = JSON.stringify({ type: 'closed', ...data })
      broadcastToWs(message)
    })

    ptyService.on('activity', (data) => {
      const message = JSON.stringify({ type: 'activity', ...data })
      broadcastToWs(message)
    })
  }

  function broadcastToWs(message) {
    if (!wss) return
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message)
      }
    })
  }

  return { wss }
}