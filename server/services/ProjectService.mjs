import { join, dirname } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { homedir } from 'os'

export class ProjectService {
  constructor() {
    // 在 Electron 环境下使用 app.getPath('userData')
    // 在纯 Node.js 环境下使用 ~/.aiterm
    this.storePath = join(homedir(), '.aiterm', 'projects.json')
    this.ensureStore()
    console.log(`ProjectService initialized, store path: ${this.storePath}`)
  }

  ensureStore() {
    const dir = dirname(this.storePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    if (!existsSync(this.storePath)) {
      writeFileSync(this.storePath, JSON.stringify({ projects: [], settings: { editorPath: null, terminalFontSize: 14 } }, null, 2))
    }
  }

  loadStore() {
    try {
      if (existsSync(this.storePath)) {
        const data = readFileSync(this.storePath, 'utf-8')
        const store = JSON.parse(data)
        // 确保数据结构正确
        if (!store.projects || !Array.isArray(store.projects)) {
          store.projects = []
        }
        if (!store.settings) {
          store.settings = { editorPath: null, terminalFontSize: 14 }
        }
        return store
      }
    } catch (e) {
      console.error('Failed to load project store:', e)
    }
    return { projects: [], settings: { editorPath: null, terminalFontSize: 14 } }
  }

  saveStore(store) {
    try {
      writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8')
    } catch (e) {
      console.error('Failed to save project store:', e)
    }
  }

  getProjects() {
    return this.loadStore().projects
  }

  addProject(name, path, group) {
    // 展开 ~ 为实际用户目录
    if (path.startsWith('~/')) {
      path = join(homedir(), path.slice(2))
    }

    const store = this.loadStore()
    const project = {
      id: uuidv4(),
      name,
      path,
      group: group || null
    }
    store.projects.push(project)
    this.saveStore(store)
    console.log(`Added project: ${name} at ${path}`)
    return project
  }

  removeProject(id) {
    const store = this.loadStore()
    store.projects = store.projects.filter((p) => p.id !== id)
    this.saveStore(store)
    console.log(`Removed project: ${id}`)
  }

  renameProject(id, newName) {
    const store = this.loadStore()
    const project = store.projects.find((p) => p.id === id)
    if (!project) {
      throw new Error('Project not found')
    }
    project.name = newName
    this.saveStore(store)
    console.log(`Renamed project ${id} to ${newName}`)
    return project
  }

  getEditorPath() {
    return this.loadStore().settings.editorPath
  }

  setEditorPath(editorPath) {
    const store = this.loadStore()
    store.settings.editorPath = editorPath
    this.saveStore(store)
    console.log(`Set editor path: ${editorPath}`)
  }

  getTerminalFontSize() {
    return this.loadStore().settings.terminalFontSize || 14
  }

  setTerminalFontSize(fontSize) {
    const store = this.loadStore()
    store.settings.terminalFontSize = fontSize
    this.saveStore(store)
    console.log(`Set terminal font size: ${fontSize}`)
  }

  openInEditor(projectPath) {
    const editorPath = this.getEditorPath()

    let appName
    if (editorPath && editorPath.trim()) {
      if (editorPath.includes('.app')) {
        appName = editorPath.split('.app')[0].split('/').pop() || 'Visual Studio Code'
      } else {
        appName = editorPath
      }
    } else {
      // 自动检测
      try {
        execSync('code --version', { stdio: 'ignore' })
        appName = 'Visual Studio Code'
      } catch {
        try {
          execSync('cursor --version', { stdio: 'ignore' })
          appName = 'Cursor'
        } catch {
          try {
            execSync('lingma --version', { stdio: 'ignore' })
            appName = 'Lingma'
          } catch {
            throw new Error('未配置编辑器，请先在设置中配置编辑器路径')
          }
        }
      }
    }

    if (process.platform === 'darwin') {
      execSync(`open -a "${appName}" "${projectPath}"`, { stdio: 'ignore' })
    } else {
      execSync(`"${editorPath || 'code'}" "${projectPath}"`, { stdio: 'ignore' })
    }
    console.log(`Opened ${projectPath} in ${appName}`)
  }
}
