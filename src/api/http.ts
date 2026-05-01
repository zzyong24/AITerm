const API_BASE = 'http://localhost:5001/api'
const WS_BASE = 'ws://localhost:5002'

export interface Project {
  id: string
  name: string
  path: string
  group: string | null
  git?: {
    isRepo: boolean
    changesCount: number
    ahead?: number
    behind?: number
  }
}

export interface SessionInfo {
  id: string
  projectId: string | null
  projectName: string | null
  workingDir: string
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  created: string[]
  deleted: string[]
  renamed: string[]
  conflicted: string[]
  isRepo: boolean
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

// HTTP API 调用
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

// 终端相关
export const createTerminalSession = (projectId: string | null, projectName: string | null, workingDir?: string) =>
  apiCall<{ sessionId: string }>('/terminals', {
    method: 'POST',
    body: JSON.stringify({ projectId, projectName, workingDir }),
  }).then(res => res.sessionId)

export const writeToTerminal = (sessionId: string, data: string) =>
  apiCall('/terminals/' + sessionId + '/write', {
    method: 'POST',
    body: JSON.stringify({ data }),
  })

export const resizeTerminal = (sessionId: string, rows: number, cols: number) =>
  apiCall('/terminals/' + sessionId + '/resize', {
    method: 'POST',
    body: JSON.stringify({ rows, cols }),
  })

export const closeTerminalSession = (sessionId: string) =>
  apiCall<void>('/terminals/' + sessionId, { method: 'DELETE' })

export const listSessions = () =>
  apiCall<SessionInfo[]>('/terminals')

// 项目相关
export const getProjects = () =>
  apiCall<Project[]>('/projects')

export const addProject = (name: string, path: string, group?: string) =>
  apiCall<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, path, group }),
  })

export const removeProject = (id: string) =>
  apiCall<void>('/projects/' + id, { method: 'DELETE' })

export const renameProject = (id: string, newName: string) =>
  apiCall<Project>('/projects/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ newName }),
  })

// 设置相关
export const getEditorPath = () =>
  apiCall<{ editorPath: string | null }>('/settings/editor').then(res => res.editorPath)

export const setEditorPath = (editorPath: string | null) =>
  apiCall<void>('/settings/editor', {
    method: 'POST',
    body: JSON.stringify({ editorPath }),
  })

// 终端字体大小
export const getTerminalFontSize = () =>
  apiCall<{ fontSize: number }>('/settings/terminal-font-size').then(res => res.fontSize)

export const setTerminalFontSize = (fontSize: number) =>
  apiCall<void>('/settings/terminal-font-size', {
    method: 'POST',
    body: JSON.stringify({ fontSize }),
  })

export const openProjectInEditor = (projectPath: string) =>
  apiCall<void>('/open-in-editor', {
    method: 'POST',
    body: JSON.stringify({ projectPath }),
  })

// 浏览器环境下选择目录 - 返回 null 让前端使用 prompt 输入
export const pickDirectory = (): Promise<string | null> => {
  return Promise.resolve(null)
}

// 文件操作
export const getHomeDir = () =>
  apiCall<string>('/home-dir')

export const readDirectory = (path: string, showHidden: boolean) =>
  apiCall<string[]>('/directory?path=' + encodeURIComponent(path) + '&showHidden=' + showHidden)

export interface DirEntryInfo {
  name: string
  path: string
  isDirectory: boolean
  isGitIgnored: boolean
  isUntracked: boolean
  isModified: boolean
  hasGitDir: boolean
}

export const readDirectoryBatch = (path: string, showHidden: boolean): Promise<DirEntryInfo[]> =>
  apiCall<DirEntryInfo[]>('/directory-batch', {
    method: 'POST',
    body: JSON.stringify({ path, showHidden }),
  })

export const isDirectory = (path: string) =>
  apiCall<boolean>('/is-directory?path=' + encodeURIComponent(path))

export const deletePath = (path: string) =>
  apiCall<void>('/path', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })

export const readFile = (path: string) =>
  apiCall<string>('/file?path=' + encodeURIComponent(path))

export const writeFile = (path: string, content: string) =>
  apiCall<void>('/file', {
    method: 'POST',
    body: JSON.stringify({ path, content }),
  })

export const pasteFile = (targetDir: string, clipboardPath: string) =>
  apiCall<void>('/paste-file', {
    method: 'POST',
    body: JSON.stringify({ targetDir, clipboardPath }),
  })

export const killPort = (port: number) =>
  apiCall<{ result: string }>('/kill-port', {
    method: 'POST',
    body: JSON.stringify({ port }),
  }).then(res => res.result)

export const isGitIgnored = (path: string) =>
  apiCall<boolean>('/is-git-ignored', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })

// 搜索
export interface SearchResult {
  file: string
  path: string
  line: number
  preview?: string
}

export const searchInDirectory = (dirPath: string, query: string) =>
  apiCall<SearchResult[]>('/search-in-directory', {
    method: 'POST',
    body: JSON.stringify({ dirPath, query }),
  })

export const searchFileContent = (dirPath: string, query: string, maxResults: number = 200, extensions?: string) =>
  apiCall<SearchResult[]>('/search-file-content', {
    method: 'POST',
    body: JSON.stringify({ dirPath, query, maxResults, extensions }),
  })

// Git
export const getGitStatus = (path: string) =>
  apiCall<GitStatus>('/git-status?path=' + encodeURIComponent(path))

export const getGitRepoBrief = (path: string) =>
  apiCall<{ isRepo: boolean; changesCount: number; rootPath?: string; ahead?: number; behind?: number }>('/git-repo-brief?path=' + encodeURIComponent(path))

export const getGitRemote = (path: string) =>
  apiCall<{ remote: string; remoteUrl: string }>('/git-remote?path=' + encodeURIComponent(path))

export const getGitLastCommit = (path: string) =>
  apiCall<{ hash: string; date: string; message: string }>('/git-last-commit?path=' + encodeURIComponent(path))

export const gitStageFile = (repoPath: string, filePath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-stage-file', {
    method: 'POST',
    body: JSON.stringify({ repoPath, filePath }),
  })

export const gitStageAll = (repoPath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-stage-all', {
    method: 'POST',
    body: JSON.stringify({ repoPath }),
  })

export const gitUnstageFile = (repoPath: string, filePath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-unstage-file', {
    method: 'POST',
    body: JSON.stringify({ repoPath, filePath }),
  })

export const gitDiscardChanges = (repoPath: string, filePath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-discard-changes', {
    method: 'POST',
    body: JSON.stringify({ repoPath, filePath }),
  })

export const gitCommit = (repoPath: string, message: string, files: string[] = []) =>
  apiCall<{ success: boolean; message: string }>('/git-commit', {
    method: 'POST',
    body: JSON.stringify({ repoPath, message, files }),
  })

export const gitPush = (repoPath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-push', {
    method: 'POST',
    body: JSON.stringify({ repoPath }),
  })

export const gitPull = (repoPath: string) =>
  apiCall<{ success: boolean; message: string }>('/git-pull', {
    method: 'POST',
    body: JSON.stringify({ repoPath }),
  })

export const execCommand = (command: string, cwd: string) =>
  apiCall<{ success: boolean; output?: string; error?: string }>('/exec', {
    method: 'POST',
    body: JSON.stringify({ command, cwd }),
  })

// 外部链接 (浏览器模式下使用 window.open)
export const openExternal = (url: string) => {
  window.open(url, '_blank')
  return Promise.resolve()
}

// 窗口控制 (浏览器模式下的空实现)
export const windowMinimize = () => Promise.resolve()
export const windowMaximize = () => Promise.resolve()
export const windowClose = () => Promise.resolve()
export const windowIsMaximized = () => Promise.resolve(false)
export const windowSetFullscreen = (_flag: boolean) => Promise.resolve()
export const windowIsFullscreen = () => Promise.resolve(false)
export const windowToggleFullscreen = () => Promise.resolve()
export const getOpenTerminalsCount = () => Promise.resolve(0)

// WebSocket 连接
type MessageHandler = (data: any) => void

class TerminalWebSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(WS_BASE)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const { type, ...payload } = data
        this.handlers.get(type)?.forEach(handler => handler(payload))
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      this.reconnectTimer = setTimeout(() => this.connect(), 1000)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler)
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
  }
}

export const terminalWs = new TerminalWebSocket()

// 便捷的 WebSocket 监听函数
export const terminalOutputListener = (callback: (data: { session_id: string; data: number[] }) => void) => {
  terminalWs.on('output', callback)
  return () => terminalWs.off('output', callback)
}

export const terminalClosedListener = (callback: (data: { session_id: string }) => void) => {
  terminalWs.on('closed', callback)
  return () => terminalWs.off('closed', callback)
}

export const terminalActivityListener = (callback: (data: { session_id: string; bytes: number }) => void) => {
  terminalWs.on('activity', callback)
  return () => terminalWs.off('activity', callback)
}

// 连接 WebSocket
terminalWs.connect()
