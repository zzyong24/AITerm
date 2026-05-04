// 统一 API 入口
// 根据环境自动选择 HTTP 或 IPC

import * as httpApi from './http'
import * as ipcApi from './electron-ipc'

// 检测是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

// 根据环境选择 API 实现
const api = isElectron ? ipcApi : httpApi

// 重新导出类型
export type { Project, SessionInfo, GitStatus, ChildTerminal, TerminalSession } from './http'
export type { WatcherEvent } from './electron-ipc'

// 重新导出所有函数（使用运行时选择）
export const createTerminalSession = api.createTerminalSession
export const writeToTerminal = api.writeToTerminal
export const resizeTerminal = api.resizeTerminal
export const closeTerminalSession = api.closeTerminalSession
export const listSessions = api.listSessions
export const getProjects = api.getProjects
export const addProject = api.addProject
export const removeProject = api.removeProject
export const renameProject = api.renameProject
export const getEditorPath = api.getEditorPath
export const setEditorPath = api.setEditorPath
export const getTerminalFontSize = api.getTerminalFontSize
export const setTerminalFontSize = api.setTerminalFontSize
export const openProjectInEditor = api.openProjectInEditor
export const pickDirectory = api.pickDirectory
export const getHomeDir = api.getHomeDir
export const readDirectory = api.readDirectory
export const readDirectoryBatch = api.readDirectoryBatch
export const isDirectory = api.isDirectory
export const deletePath = api.deletePath
export const readFile = api.readFile
export const writeFile = api.writeFile
export const pasteFile = api.pasteFile
export const killPort = api.killPort
export const clearAllState = api.clearAllState
export const isGitIgnored = api.isGitIgnored
export const searchInDirectory = api.searchInDirectory
export const searchFileContent = api.searchFileContent
export const getGitStatus = api.getGitStatus
export const getGitRepoBrief = api.getGitRepoBrief
export const getGitRemote = api.getGitRemote
export const getGitLastCommit = api.getGitLastCommit
export const gitStageFile = api.gitStageFile
export const gitStageAll = api.gitStageAll
export const gitUnstageFile = api.gitUnstageFile
export const gitDiscardChanges = api.gitDiscardChanges
export const gitCommit = api.gitCommit
export const gitPush = api.gitPush
export const gitPull = api.gitPull
export const execCommand = api.execCommand
export const openExternal = api.openExternal
export const terminalOutputListener = api.terminalOutputListener
export const terminalClosedListener = api.terminalClosedListener
export const terminalActivityListener = api.terminalActivityListener
export const terminalRenamedListener = api.terminalRenamedListener
export const stateChangedListener = api.stateChangedListener
export const terminalWs = api.terminalWs
export const windowMinimize = api.windowMinimize
export const windowMaximize = api.windowMaximize
export const windowClose = api.windowClose
export const windowIsMaximized = api.windowIsMaximized
export const windowSetFullscreen = api.windowSetFullscreen
export const windowIsFullscreen = api.windowIsFullscreen
export const windowToggleFullscreen = api.windowToggleFullscreen
export const getOpenTerminalsCount = api.getOpenTerminalsCount

// 文件监听
export const startWatcher = api.startWatcher
export const stopWatcher = api.stopWatcher
export const stopAllWatchers = api.stopAllWatchers
export const getWatcherInfo = api.getWatcherInfo
export const watcherAddListener = api.watcherAddListener
export const watcherUnlinkListener = api.watcherUnlinkListener
export const watcherAddDirListener = api.watcherAddDirListener
export const watcherUnlinkDirListener = api.watcherUnlinkDirListener

// 终端历史
export const saveTerminalHistory = api.saveTerminalHistory
export const loadTerminalHistory = api.loadTerminalHistory
export const clearTerminalHistory = api.clearTerminalHistory

// 终端列表保存/恢复
export const saveTerminals = api.saveTerminals
export const loadTerminals = api.loadTerminals
export const clearTerminals = api.clearTerminals
export const renameTerminal = api.renameTerminal

// 编辑器列表保存/恢复
export const saveEditors = api.saveEditors
export const loadEditors = api.loadEditors

// 跨端持久化 API（SQLite）
export type { PersistedState } from './http'
export const getFullState = api.getFullState
export const updateFullState = api.updateFullState
export const persistTerminal = api.persistTerminal
export const updatePersistedTerminal = api.updatePersistedTerminal
export const removePersistedTerminal = api.removePersistedTerminal
export const updateEditors = api.updateEditors
export const removeEditor = api.removeEditor

// 导出环境检测结果
export const isRunningInElectron = isElectron

if (!isElectron) {
  console.log('Running in browser environment - using HTTP')
}
