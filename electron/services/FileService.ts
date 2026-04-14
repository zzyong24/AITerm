import { homedir } from 'os'
import { existsSync, readdirSync, statSync, unlinkSync, rmdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { execSync } from 'child_process'
import log from 'electron-log'

export interface SearchResult {
  file: string
  path: string
  line: number
  preview?: string
}

export class FileService {
  getHomeDir(): string {
    return homedir()
  }

  async readDirectory(dirPath: string, showHidden: boolean): Promise<string[]> {
    try {
      const entries = readdirSync(dirPath)
      return entries.filter((name) => {
        if (!showHidden && (name.startsWith('.') || name === 'node_modules')) {
          return false
        }
        return true
      })
    } catch (e) {
      log.error(`Failed to read directory ${dirPath}:`, e)
      throw e
    }
  }

  async readDirectoryBatch(dirPath: string, showHidden: boolean): Promise<{ name: string; path: string; isDirectory: boolean; isGitIgnored: boolean }[]> {
    try {
      const entries = readdirSync(dirPath)
      const filtered = entries.filter((name) => {
        if (!showHidden && (name.startsWith('.') || name === 'node_modules')) {
          return false
        }
        return true
      })

      const results = []
      for (const name of filtered) {
        const fullPath = dirPath.endsWith('/') ? `${dirPath}${name}` : `${dirPath}/${name}`
        let isDir = false
        let isGitIgnored = false
        try {
          isDir = statSync(fullPath).isDirectory()
        } catch {}
        try {
          isGitIgnored = this.isGitIgnored(fullPath)
        } catch {}
        results.push({
          name,
          path: fullPath,
          isDirectory: isDir,
          isGitIgnored
        })
      }

      // 排序：目录在前，文件在后
      return results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (e) {
      log.error(`Failed to read directory batch ${dirPath}:`, e)
      throw e
    }
  }

  isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  }

  async deletePath(path: string): Promise<void> {
    try {
      const stat = statSync(path)
      if (stat.isDirectory()) {
        this.deleteDirectoryRecursive(path)
      } else {
        unlinkSync(path)
      }
      log.info(`Deleted path: ${path}`)
    } catch (e) {
      log.error(`Failed to delete path ${path}:`, e)
      throw e
    }
  }

  private deleteDirectoryRecursive(path: string): void {
    if (existsSync(path)) {
      const entries = readdirSync(path)
      for (const entry of entries) {
        const entryPath = join(path, entry)
        if (statSync(entryPath).isDirectory()) {
          this.deleteDirectoryRecursive(entryPath)
        } else {
          unlinkSync(entryPath)
        }
      }
      rmdirSync(path)
    }
  }

  async pasteFile(targetDir: string, clipboardPath: string): Promise<void> {
    try {
      const source = clipboardPath
      const destName = basename(source)
      const dest = join(targetDir, destName)

      const stat = statSync(source)
      if (stat.isDirectory()) {
        this.copyDirectoryRecursive(source, dest)
      } else {
        copyFileSync(source, dest)
      }
      log.info(`Pasted ${source} to ${dest}`)
    } catch (e) {
      log.error(`Failed to paste file:`, e)
      throw e
    }
  }

  private copyDirectoryRecursive(src: string, dst: string): void {
    if (!existsSync(dst)) {
      mkdirSync(dst, { recursive: true })
    }
    const entries = readdirSync(src)
    for (const entry of entries) {
      const srcPath = join(src, entry)
      const dstPath = join(dst, entry)
      if (statSync(srcPath).isDirectory()) {
        this.copyDirectoryRecursive(srcPath, dstPath)
      } else {
        copyFileSync(srcPath, dstPath)
      }
    }
  }

  isGitIgnored(path: string): boolean {
    try {
      // 先找到git仓库根目录
      const gitDir = execSync(`git -C "${path}" rev-parse --show-toplevel 2>/dev/null`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()

      if (!gitDir) return false

      // 在git仓库根目录执行check-ignore
      const result = execSync(`git check-ignore "${path}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: gitDir
      })
      return result.trim().length > 0
    } catch {
      return false
    }
  }

  async killPort(port: number): Promise<string> {
    try {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' })
      const pids = output.trim().split('\n').filter(Boolean)

      if (pids.length === 0) {
        throw new Error(`No process found on port ${port}`)
      }

      const killed: string[] = []
      const errors: string[] = []

      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
          killed.push(pid)
        } catch (e) {
          errors.push(`PID ${pid}: failed to kill`)
        }
      }

      if (killed.length === 0) {
        throw new Error(errors.join(', '))
      }

      log.info(`Killed processes on port ${port}: ${killed.join(', ')}`)
      return `Killed: ${killed.join(', ')}`
    } catch (e) {
      log.error(`Failed to kill port ${port}:`, e)
      throw e
    }
  }

  async searchInDirectory(dirPath: string, query: string, maxResults: number = 100): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    const searchRecursive = async (currentPath: string, depth: number = 0) => {
      if (results.length >= maxResults) return
      if (depth > 10) return // Prevent too deep recursion

      try {
        const entries = readdirSync(currentPath)

        for (const entry of entries) {
          if (results.length >= maxResults) break
          if (entry === 'node_modules' || entry === '.git') continue

          const fullPath = join(currentPath, entry)

          try {
            const stat = statSync(fullPath)

            if (stat.isDirectory()) {
              await searchRecursive(fullPath, depth + 1)
            } else {
              // Check if filename matches
              if (entry.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                  file: entry,
                  path: fullPath,
                  line: 0
                })
              }
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      } catch (e) {
        // Skip directories we can't access
      }
    }

    await searchRecursive(dirPath)
    return results
  }

  async searchFileContent(dirPath: string, query: string, maxResults: number = 100): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    const searchRecursive = async (currentPath: string, depth: number = 0) => {
      if (results.length >= maxResults) return
      if (depth > 10) return

      try {
        const entries = readdirSync(currentPath)

        for (const entry of entries) {
          if (results.length >= maxResults) break
          if (entry === 'node_modules' || entry === '.git') continue

          const fullPath = join(currentPath, entry)

          try {
            const stat = statSync(fullPath)

            if (stat.isDirectory()) {
              await searchRecursive(fullPath, depth + 1)
            } else {
              // Skip binary files
              if (this.isBinaryFile(entry)) continue

              // Search in file content
              const content = readFileSync(fullPath, 'utf-8')
              const lines = content.split('\n')

              for (let i = 0; i < lines.length; i++) {
                if (results.length >= maxResults) break
                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                  // Get context preview (surrounding lines)
                  const preview = this.getSearchPreview(lines, i, query)
                  results.push({
                    file: entry,
                    path: fullPath,
                    line: i + 1,
                    preview
                  })
                }
              }
            }
          } catch (e) {
            // Skip files we can't access
          }
        }
      } catch (e) {
        // Skip directories we can't access
      }
    }

    await searchRecursive(dirPath)
    return results
  }

  private isBinaryFile(filename: string): boolean {
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z']
    const ext = filename.toLowerCase()
    return binaryExtensions.some(e => ext.endsWith(e))
  }

  private getSearchPreview(lines: string[], matchLine: number, query: string): string {
    const start = Math.max(0, matchLine - 1)
    const end = Math.min(lines.length - 1, matchLine + 1)
    const previewLines: string[] = []

    for (let i = start; i <= end; i++) {
      const lineNum = i + 1
      const line = lines[i]
      const displayLine = line.length > 120 ? line.substring(0, 120) + '...' : line
      previewLines.push(`${lineNum}: ${displayLine}`)
    }

return previewLines.join('\n')
  }

  async readFile(path: string): Promise<string> {
    try {
      return readFileSync(path, 'utf-8')
    } catch (e) {
      log.error(`Failed to read file ${path}:`, e)
      throw e
    }
  }

async writeFile(path: string, content: string): Promise<void> {
    try {
      writeFileSync(path, content, 'utf-8')
    } catch (e) {
      log.error(`Failed to write file ${path}:`, e)
      throw e
    }
  }

  // ============ 终端历史 ============
  private getHistoryDir(projectPath: string): string {
    return join(projectPath, '.aiterm')
  }

  private getHistoryFilePath(projectPath: string): string {
    return join(this.getHistoryDir(projectPath), 'terminal-history.json')
  }

  saveTerminalHistory(projectPath: string, workingDir: string, entries: { type: 'input' | 'output'; content: string; timestamp: number }[]): void {
    try {
      const historyDir = this.getHistoryDir(projectPath)
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true })
      }
      const historyFile = this.getHistoryFilePath(projectPath)
      // 读取现有历史
      let existingHistory: { dir: string; entries: { type: 'input' | 'output'; content: string; timestamp: number }[] }[] = []
      if (existsSync(historyFile)) {
        try {
          existingHistory = JSON.parse(readFileSync(historyFile, 'utf-8'))
        } catch {}
      }
      // 更新当前目录的历史
      const dirIndex = existingHistory.findIndex(h => h.dir === workingDir)
      if (dirIndex >= 0) {
        existingHistory[dirIndex].entries = entries.slice(-1000)
      } else {
        existingHistory.push({ dir: workingDir, entries: entries.slice(-1000) })
      }
      // 限制只保存20个目录的历史
      if (existingHistory.length > 20) {
        existingHistory = existingHistory.slice(-20)
      }
      writeFileSync(historyFile, JSON.stringify(existingHistory), 'utf-8')
    } catch (e) {
      log.error(`Failed to save terminal history:`, e)
    }
  }

  loadTerminalHistory(projectPath: string, workingDir: string): { type: 'input' | 'output'; content: string; timestamp: number }[] {
    try {
      const historyFile = this.getHistoryFilePath(projectPath)
      if (!existsSync(historyFile)) {
        return []
      }
      const content = readFileSync(historyFile, 'utf-8')
      const history = JSON.parse(content) as { dir: string; entries: { type: 'input' | 'output'; content: string; timestamp: number }[] }[]
      const dirHistory = history.find(h => h.dir === workingDir)
      return dirHistory?.entries || []
    } catch (e) {
      log.error(`Failed to load terminal history:`, e)
      return []
    }
  }

  clearTerminalHistory(projectPath: string, workingDir: string): void {
    try {
      const historyFile = this.getHistoryFilePath(projectPath)
      if (!existsSync(historyFile)) return
      const content = readFileSync(historyFile, 'utf-8')
      let history = JSON.parse(content) as { dir: string; entries: any }[]
      history = history.filter(h => h.dir !== workingDir)
      writeFileSync(historyFile, JSON.stringify(history), 'utf-8')
    } catch (e) {
      log.error(`Failed to clear terminal history:`, e)
    }
  }

  // ============ 终端列表保存/恢复 ============
  private getTerminalsFilePath(projectPath: string): string {
    return join(this.getHistoryDir(projectPath), 'terminals.json')
  }

  saveTerminals(projectPath: string, terminals: { workingDir: string }[]): void {
    try {
      const historyDir = this.getHistoryDir(projectPath)
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true })
      }
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      writeFileSync(terminalsFile, JSON.stringify({ projectPath, terminals }), 'utf-8')
    } catch (e) {
      log.error(`Failed to save terminals:`, e)
    }
  }

  loadTerminals(projectPath: string): { workingDir: string }[] {
    try {
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      if (!existsSync(terminalsFile)) {
        return []
      }
      const content = readFileSync(terminalsFile, 'utf-8')
      const data = JSON.parse(content)
      return data.terminals || []
    } catch (e) {
      log.error(`Failed to load terminals:`, e)
      return []
    }
  }

  clearTerminals(projectPath: string): void {
    try {
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      if (existsSync(terminalsFile)) {
        unlinkSync(terminalsFile)
      }
    } catch (e) {
      log.error(`Failed to clear terminals:`, e)
    }
  }
}
