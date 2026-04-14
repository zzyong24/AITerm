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
export const isGitIgnored = api.isGitIgnored
export const searchInDirectory = api.searchInDirectory
export const searchFileContent = api.searchFileContent
export const getGitStatus = api.getGitStatus
export const execCommand = api.execCommand
export const terminalOutputListener = api.terminalOutputListener
export const terminalClosedListener = api.terminalClosedListener
export const terminalActivityListener = api.terminalActivityListener
export const terminalWs = api.terminalWs
export const windowMinimize = api.windowMinimize
export const windowMaximize = api.windowMaximize
export const windowClose = api.windowClose
export const windowIsMaximized = api.windowIsMaximized
export const windowSetFullscreen = api.windowSetFullscreen
export const windowIsFullscreen = api.windowIsFullscreen
export const windowToggleFullscreen = api.windowToggleFullscreen

// 终端历史
export const saveTerminalHistory = api.saveTerminalHistory
export const loadTerminalHistory = api.loadTerminalHistory
export const clearTerminalHistory = api.clearTerminalHistory

// 终端列表保存/恢复
export const saveTerminals = api.saveTerminals
export const loadTerminals = api.loadTerminals
export const clearTerminals = api.clearTerminals

// 导出环境检测结果
export const isRunningInElectron = isElectron

if (!isElectron) {
  console.log('Running in browser environment - using HTTP')
}
