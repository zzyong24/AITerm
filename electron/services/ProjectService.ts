import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'
import { homedir } from 'os'

export interface Project {
  id: string
  name: string
  path: string
  group: string | null
}

interface AppSettings {
  editorPath: string | null
}

interface ProjectStore {
  projects: Project[]
  settings: AppSettings
}

export class ProjectService {
  private storePath: string

  constructor() {
    const aitermDir = join(homedir(), '.aiterm')
    if (!existsSync(aitermDir)) {
      mkdirSync(aitermDir, { recursive: true })
    }
    this.storePath = join(aitermDir, 'projects.json')
    log.info(`ProjectService initialized, store path: ${this.storePath}`)
  }

  private loadStore(): ProjectStore {
    try {
      if (existsSync(this.storePath)) {
        const data = readFileSync(this.storePath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (e) {
      log.error('Failed to load project store:', e)
    }
    return { projects: [], settings: { editorPath: null } }
  }

  private saveStore(store: ProjectStore): void {
    try {
      writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8')
    } catch (e) {
      log.error('Failed to save project store:', e)
    }
  }

  getProjects(): Project[] {
    return this.loadStore().projects
  }

  addProject(name: string, path: string, group?: string): Project {
    const store = this.loadStore()
    const project: Project = {
      id: uuidv4(),
      name,
      path,
      group: group || null
    }
    store.projects.push(project)
    this.saveStore(store)
    log.info(`Added project: ${name} at ${path}`)
    return project
  }

  async removeProject(id: string): Promise<void> {
    const store = this.loadStore()
    store.projects = store.projects.filter((p) => p.id !== id)
    this.saveStore(store)
    log.info(`Removed project: ${id}`)
  }

  renameProject(id: string, newName: string): Project {
    const store = this.loadStore()
    const project = store.projects.find((p) => p.id === id)
    if (!project) {
      throw new Error('Project not found')
    }
    project.name = newName
    this.saveStore(store)
    log.info(`Renamed project ${id} to ${newName}`)
    return project
  }

  getEditorPath(): string | null {
    return this.loadStore().settings.editorPath
  }

  async setEditorPath(editorPath: string | null): Promise<void> {
    const store = this.loadStore()
    store.settings.editorPath = editorPath
    this.saveStore(store)
    log.info(`Set editor path: ${editorPath}`)
  }

  async openInEditor(projectPath: string): Promise<void> {
    const editorPath = this.getEditorPath()

    let appName: string
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
          throw new Error('未配置编辑器，请先在设置中配置编辑器路径')
        }
      }
    }

    if (process.platform === 'darwin') {
      execSync(`open -a "${appName}" "${projectPath}"`, { stdio: 'ignore' })
    } else {
      execSync(`"${editorPath || 'code'}" "${projectPath}"`, { stdio: 'ignore' })
    }
    log.info(`Opened ${projectPath} in ${appName}`)
  }
}
