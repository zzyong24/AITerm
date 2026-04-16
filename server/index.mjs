import express from 'express'
import cors from 'cors'
import { PtyService } from './services/PtyService.mjs'
import { ProjectService } from './services/ProjectService.mjs'
import { FileService } from './services/FileService.mjs'
import { GitService } from './services/GitService.mjs'

const app = express()
const PORT = 5001

app.use(cors())
app.use(express.json())

// 创建服务实例
const ptyService = new PtyService()
const projectService = new ProjectService()
const fileService = new FileService()
const gitService = new GitService()

// 终端相关 API
app.post('/api/terminals', async (req, res) => {
  try {
    const { projectId, projectName, workingDir } = req.body
    const sessionId = await ptyService.createSession(projectId, projectName, workingDir)
    res.json({ sessionId })
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

// 项目相关 API
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

// 设置相关 API
app.get('/api/settings/editor', (_, res) => {
  res.json({ editorPath: projectService.getEditorPath() })
})

app.post('/api/settings/editor', (req, res) => {
  const { editorPath } = req.body
  projectService.setEditorPath(editorPath)
  res.json({ success: true })
})

// 终端字体大小设置
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

// 目录选择
app.get('/api/pick-directory', async (_, res) => {
  // 在 Electron 环境下会使用原生对话框，这里返回 null 让前端使用 Electron API
  res.json(null)
})

// 文件操作 API
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
    const { port } = req.body
    const result = await fileService.killPort(port)
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

// 终端列表保存/恢复
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

app.post('/api/is-git-ignored', async (req, res) => {
  try {
    const { path } = req.body
    const result = fileService.isGitIgnored(path)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 执行命令行
app.post('/api/exec', async (req, res) => {
  try {
    const { command, cwd } = req.body
    const result = fileService.execCommand(command, cwd)
    res.json(result)
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// 搜索 API
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

// Git API
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

// WebSocket 用于终端输出推送
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: PORT + 1 })

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
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message)
    }
  })
})

ptyService.on('closed', (data) => {
  const message = JSON.stringify({ type: 'closed', ...data })
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message)
    }
  })
})

ptyService.on('activity', (data) => {
  const message = JSON.stringify({ type: 'activity', ...data })
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message)
    }
  })
})

app.listen(PORT, () => {
  console.log(`AITerm backend server running on http://localhost:${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT + 1}`)
})
