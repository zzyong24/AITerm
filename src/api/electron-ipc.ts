// Electron IPC API - 打包后使用
// 通过 preload.ts 暴露的 window.electronAPI 调用

export interface Project {
  id: string
  name: string
  path: string
  group: string | null
  git?: {
    isRepo: boolean
    changesCount: number
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

// 使用 window.electronAPI (通过 preload 暴露)
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (data: any) => void) => () => void
    }
  }
}

// 终端相关
export const createTerminalSession = (projectId: string | null, projectName: string | null, workingDir?: string) =>
  window.electronAPI.invoke<string>('create-terminal-session', projectId, projectName, workingDir)

export const writeToTerminal = (sessionId: string, data: string) =>
  window.electronAPI.invoke('write-to-terminal', sessionId, data)

export const resizeTerminal = (sessionId: string, rows: number, cols: number) =>
  window.electronAPI.invoke('resize-terminal', sessionId, rows, cols)

export const closeTerminalSession = (sessionId: string) =>
  window.electronAPI.invoke('close-terminal-session', sessionId)

export const listSessions = () =>
  window.electronAPI.invoke<SessionInfo[]>('list-sessions')

// 项目相关
export const getProjects = () =>
  window.electronAPI.invoke<Project[]>('get-projects')

export const addProject = (name: string, path: string, group?: string) =>
  window.electronAPI.invoke<Project>('add-project', name, path, group)

export const removeProject = (id: string) =>
  window.electronAPI.invoke('remove-project', id)

export const renameProject = (id: string, newName: string) =>
  window.electronAPI.invoke<Project>('rename-project', id, newName)

// 设置相关
export const getEditorPath = () =>
  window.electronAPI.invoke<string | null>('get-editor-path')

export const setEditorPath = (editorPath: string | null) =>
  window.electronAPI.invoke('set-editor-path', editorPath)

export const getTerminalFontSize = () =>
  window.electronAPI.invoke<number>('get-terminal-font-size')

export const setTerminalFontSize = (fontSize: number) =>
  window.electronAPI.invoke('set-terminal-font-size', fontSize)

export const openProjectInEditor = (projectPath: string) =>
  window.electronAPI.invoke('open-project-in-editor', projectPath)

export const pickDirectory = () =>
  window.electronAPI.invoke<string | null>('pick-directory')

// 文件操作
export const getHomeDir = () =>
  window.electronAPI.invoke<string>('get-home-dir')

export const readDirectory = (path: string, showHidden: boolean) =>
  window.electronAPI.invoke<string[]>('read-directory', path, showHidden)

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
  window.electronAPI.invoke<DirEntryInfo[]>('read-directory-batch', path, showHidden)

export const isDirectory = (path: string) =>
  window.electronAPI.invoke<boolean>('is-directory', path)

export const deletePath = (path: string) =>
  window.electronAPI.invoke('delete-path', path)

export const readFile = (path: string) =>
  window.electronAPI.invoke<string>('read-file', path)

export const writeFile = (path: string, content: string) =>
  window.electronAPI.invoke('write-file', path, content)

export const pasteFile = (targetDir: string, clipboardPath: string) =>
  window.electronAPI.invoke('paste-file', targetDir, clipboardPath)

export const killPort = (port: number) =>
  window.electronAPI.invoke<string>('kill-port', port)

export const isGitIgnored = (path: string) =>
  window.electronAPI.invoke<boolean>('is-git-ignored', path)

// 搜索相关
export const searchInDirectory = (dirPath: string, query: string) =>
  window.electronAPI.invoke<{ file: string; path: string; line: number; preview?: string }[]>('search-in-directory', dirPath, query)

export const searchFileContent = (dirPath: string, query: string, maxResults: number = 200, extensions?: string) =>
  window.electronAPI.invoke<{ file: string; path: string; line: number; preview?: string }[]>('search-file-content', dirPath, query, maxResults, extensions)

// Git
export const getGitStatus = (path: string) =>
  window.electronAPI.invoke<GitStatus>('get-git-status', path)

export const getGitRepoBrief = (path: string) =>
  window.electronAPI.invoke<{ isRepo: boolean; changesCount: number; rootPath?: string; ahead?: number; behind?: number }>('get-git-repo-brief', path)

export const getGitRemote = (path: string) =>
  window.electronAPI.invoke<{ remote: string; remoteUrl: string }>('get-git-remote', path)

export const getGitLastCommit = (path: string) =>
  window.electronAPI.invoke<{ hash: string; date: string; message: string }>('get-git-last-commit', path)

export interface GitOperationResult {
  success: boolean
  message: string
}

export const gitStageFile = (repoPath: string, filePath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-stage-file', repoPath, filePath)

export const gitStageAll = (repoPath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-stage-all', repoPath)

export const gitUnstageFile = (repoPath: string, filePath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-unstage-file', repoPath, filePath)

export const gitCommit = (repoPath: string, message: string, files: string[] = []) =>
  window.electronAPI.invoke<GitOperationResult>('git-commit', repoPath, message, files)

export const gitPush = (repoPath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-push', repoPath)

export const gitPull = (repoPath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-pull', repoPath)

export const gitDiscardChanges = (repoPath: string, filePath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-discard-changes', repoPath, filePath)

// 执行命令行
export const execCommand = (command: string, cwd: string) =>
  window.electronAPI.invoke<{ success: boolean; output?: string; error?: string }>('exec-command', command, cwd)

// 外部链接
export const openExternal = (url: string) =>
  window.electronAPI.invoke('open-external', url)

// WebSocket 监听 - Electron IPC 模式使用事件
export const terminalOutputListener = (callback: (data: { session_id: string; data: number[] }) => void) => {
  return window.electronAPI.on('terminal-output', callback)
}

export const terminalClosedListener = (callback: (data: { session_id: string }) => void) => {
  return window.electronAPI.on('terminal-closed', callback)
}

export const terminalActivityListener = (callback: (data: { session_id: string; bytes: number }) => void) => {
  return window.electronAPI.on('terminal-activity', callback)
}

// WebSocket 类 (空的，因为在 Electron 中不需要)
export const terminalWs = {
  connect: () => { },
  disconnect: () => { }
}

// 窗口控制
export const windowMinimize = () => window.electronAPI.invoke('window-minimize')
export const windowMaximize = () => window.electronAPI.invoke('window-maximize')
export const windowClose = () => window.electronAPI.invoke('window-close')
export const windowIsMaximized = () => window.electronAPI.invoke<boolean>('window-is-maximized')
export const windowSetFullscreen = (flag: boolean) => window.electronAPI.invoke('window-set-fullscreen', flag)
export const windowIsFullscreen = () => window.electronAPI.invoke<boolean>('window-is-fullscreen')
export const windowToggleFullscreen = () => window.electronAPI.invoke('window-toggle-fullscreen')

// 查询打开的终端数量
export const getOpenTerminalsCount = () => window.electronAPI.invoke<number>('get-open-terminals-count')

// 文件监听
export const startWatcher = (projectPath: string, rootPath: string) =>
  window.electronAPI.invoke('start-watcher', projectPath, rootPath)

export const stopWatcher = (projectPath: string) =>
  window.electronAPI.invoke('stop-watcher', projectPath)

export const stopAllWatchers = () =>
  window.electronAPI.invoke('stop-all-watchers')

export const getWatcherInfo = () =>
  window.electronAPI.invoke<string[]>('get-watcher-info')

export interface WatcherEvent {
  projectPath: string
  parentPath: string
  name: string
  isDirectory: boolean
}

export const watcherAddListener = (callback: (data: WatcherEvent) => void) => {
  return window.electronAPI.on('watcher-add', callback)
}

export const watcherUnlinkListener = (callback: (data: WatcherEvent) => void) => {
  return window.electronAPI.on('watcher-unlink', callback)
}

export const watcherAddDirListener = (callback: (data: WatcherEvent) => void) => {
  return window.electronAPI.on('watcher-addDir', callback)
}

export const watcherUnlinkDirListener = (callback: (data: WatcherEvent) => void) => {
  return window.electronAPI.on('watcher-unlinkDir', callback)
}

// 跨端持久化 API（SQLite）- Electron IPC 模式存根
export interface PersistedState {
  projects: Array<{ id: string; name: string; path: string; order?: number; createdAt?: string; lastAccessedAt?: string }>
  terminals: Array<{ id: string; name: string; cwd: string; taskSlug?: string; history?: HistoryEntry[]; createdAt?: string; lastActiveAt?: string }>
  editors: Array<{ projectId: string; id: string; path: string; name: string; scrollToLine?: number }>
}

export const getFullState = (): Promise<PersistedState> =>
  window.electronAPI.invoke<PersistedState>('get-full-state')

export const updateFullState = (state: Partial<PersistedState>) =>
  window.electronAPI.invoke('update-full-state', state)

export const persistTerminal = (id: string, name: string, cwd: string, taskSlug?: string) =>
  window.electronAPI.invoke('persist-terminal', id, name, cwd, taskSlug)

export const updatePersistedTerminal = (id: string, updates: { name?: string; cwd?: string; taskSlug?: string; history?: HistoryEntry[] }) =>
  window.electronAPI.invoke('update-persisted-terminal', id, updates)

export const removePersistedTerminal = (id: string) =>
  window.electronAPI.invoke('remove-persisted-terminal', id)

export const updateEditors = (editors: { projectId: string; id: string; path: string; name: string; scrollToLine?: number }[]) =>
  window.electronAPI.invoke('update-editors', editors)

export const removeEditor = (projectId: string, id: string) =>
  window.electronAPI.invoke('remove-editor', projectId, id)
