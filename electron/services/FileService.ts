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
}
