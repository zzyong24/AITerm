// Electron IPC API - 打包后使用
// 通过 preload.ts 暴露的 window.electronAPI 调用

export interface Project {
  id: string
  name: string
  path: string
  group: string | null
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
  window.electronAPI.invoke<{ file: string; path: string; line: number }[]>('search-in-directory', dirPath, query)

export const searchFileContent = (dirPath: string, query: string) =>
  window.electronAPI.invoke<{ file: string; path: string; line: number }[]>('search-file-content', dirPath, query)

// Git
export const getGitStatus = (path: string) =>
  window.electronAPI.invoke<GitStatus>('get-git-status', path)

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

export const gitCommit = (repoPath: string, message: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-commit', repoPath, message)

export const gitPush = (repoPath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-push', repoPath)

export const gitPull = (repoPath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-pull', repoPath)

export const gitDiscardChanges = (repoPath: string, filePath: string) =>
  window.electronAPI.invoke<GitOperationResult>('git-discard-changes', repoPath, filePath)

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
  connect: () => {},
  disconnect: () => {}
}

// 窗口控制
export const windowMinimize = () => window.electronAPI.invoke('window-minimize')
export const windowMaximize = () => window.electronAPI.invoke('window-maximize')
export const windowClose = () => window.electronAPI.invoke('window-close')
export const windowIsMaximized = () => window.electronAPI.invoke<boolean>('window-is-maximized')
export const windowSetFullscreen = (flag: boolean) => window.electronAPI.invoke('window-set-fullscreen', flag)
export const windowIsFullscreen = () => window.electronAPI.invoke<boolean>('window-is-fullscreen')
export const windowToggleFullscreen = () => window.electronAPI.invoke('window-toggle-fullscreen')
