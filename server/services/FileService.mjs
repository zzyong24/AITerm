import { homedir } from 'os'
import { existsSync, readdirSync, statSync, unlinkSync, rmdirSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { execSync } from 'child_process'

export class FileService {
  getHomeDir() {
    return homedir()
  }

  async readDirectory(dirPath, showHidden) {
    try {
      const entries = readdirSync(dirPath)
      return entries.filter((name) => {
        if (name === '.DS_Store') {
          return false
        }
        if (!showHidden && name.startsWith('.')) {
          return false
        }
        return true
      })
    } catch (e) {
      console.error(`Failed to read directory ${dirPath}:`, e)
      throw e
    }
  }

  async readDirectoryBatch(dirPath, showHidden) {
    try {
      const entries = readdirSync(dirPath)
      const filtered = entries.filter((name) => {
        if (name === '.DS_Store') {
          return false
        }
        if (!showHidden && name.startsWith('.')) {
          return false
        }
        return true
      })

      // Get git repo root and status for untracked and modified file detection
      let untrackedPaths = new Set()
      let modifiedPaths = new Set()
      try {
        const gitDir = execSync(`git -C "${dirPath}" rev-parse --show-toplevel 2>/dev/null`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim()
        if (gitDir) {
          const untrackedOutput = execSync(`git -C "${gitDir}" ls-files --others --exclude-standard`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          })
          untrackedOutput.trim().split('\n').filter(Boolean).forEach(f => {
            const absPath = join(gitDir, f)
            untrackedPaths.add(absPath)
          })
          const modifiedOutput = execSync(`git -C "${gitDir}" diff --name-only`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          })
          modifiedOutput.trim().split('\n').filter(Boolean).forEach(f => {
            const absPath = join(gitDir, f)
            modifiedPaths.add(absPath)
          })
        }
      } catch {}

      const results = []
      for (const name of filtered) {
        const fullPath = dirPath.endsWith('/') ? `${dirPath}${name}` : `${dirPath}/${name}`
        let isDir = false
        let isGitIgnored = false
        let size = 0
        try {
          const stat = statSync(fullPath)
          isDir = stat.isDirectory()
          size = stat.size
        } catch {}
        try {
          isGitIgnored = this.isGitIgnored(fullPath)
        } catch {}
        results.push({
          name,
          path: fullPath,
          isDirectory: isDir,
          isGitIgnored,
          isUntracked: untrackedPaths.has(fullPath),
          isModified: modifiedPaths.has(fullPath),
          size
        })
      }

      // 排序：目录在前，文件在后
      return results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (e) {
      console.error(`Failed to read directory batch ${dirPath}:`, e)
      throw e
    }
  }

  isDirectory(path) {
    try {
      return statSync(path).isDirectory()
    } catch {
      return false
    }
  }

  async deletePath(path) {
    try {
      const stat = statSync(path)
      if (stat.isDirectory()) {
        this.deleteDirectoryRecursive(path)
      } else {
        unlinkSync(path)
      }
      console.log(`Deleted path: ${path}`)
    } catch (e) {
      console.error(`Failed to delete path ${path}:`, e)
      throw e
    }
  }

  deleteDirectoryRecursive(path) {
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

  async pasteFile(targetDir, clipboardPath) {
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
      console.log(`Pasted ${source} to ${dest}`)
    } catch (e) {
      console.error('Failed to paste file:', e)
      throw e
    }
  }

  copyDirectoryRecursive(src, dst) {
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

  async killPort(port) {
    try {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' })
      const pids = output.trim().split('\n').filter(Boolean)

      if (pids.length === 0) {
        throw new Error(`No process found on port ${port}`)
      }

      const killed = []
      const errors = []

      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
          killed.push(pid)
        } catch {
          errors.push(`PID ${pid}: failed to kill`)
        }
      }

      if (killed.length === 0) {
        throw new Error(errors.join(', '))
      }

      console.log(`Killed processes on port ${port}: ${killed.join(', ')}`)
      return `Killed: ${killed.join(', ')}`
    } catch (e) {
      console.error(`Failed to kill port ${port}:`, e)
      throw e
    }
  }

  isGitIgnored(path) {
    try {
      const gitDir = execSync(`git -C "${path}" rev-parse --show-toplevel 2>/dev/null`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()

      if (!gitDir) return false

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

  // ============ 终端历史 ============
  getHistoryDir(projectPath) {
    return join(projectPath, '.aiterm')
  }

  getHistoryFilePath(projectPath) {
    return join(this.getHistoryDir(projectPath), 'terminal-history.json')
  }

  saveTerminalHistory(projectPath, workingDir, entries) {
    try {
      const historyDir = this.getHistoryDir(projectPath)
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true })
      }
      const historyFile = this.getHistoryFilePath(projectPath)
      // 读取现有历史
      let existingHistory = []
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
      console.error(`Failed to save terminal history:`, e)
    }
  }

  loadTerminalHistory(projectPath, workingDir) {
    try {
      const historyFile = this.getHistoryFilePath(projectPath)
      if (!existsSync(historyFile)) {
        return []
      }
      const content = readFileSync(historyFile, 'utf-8')
      const history = JSON.parse(content)
      const dirHistory = history.find(h => h.dir === workingDir)
      return dirHistory?.entries || []
    } catch (e) {
      console.error(`Failed to load terminal history:`, e)
      return []
    }
  }

  clearTerminalHistory(projectPath, workingDir) {
    try {
      const historyFile = this.getHistoryFilePath(projectPath)
      if (!existsSync(historyFile)) return
      let history = JSON.parse(readFileSync(historyFile, 'utf-8'))
      history = history.filter(h => h.dir !== workingDir)
      writeFileSync(historyFile, JSON.stringify(history), 'utf-8')
    } catch (e) {
      console.error(`Failed to clear terminal history:`, e)
    }
  }

  // ============ 终端列表保存/恢复 ============
  getTerminalsFilePath(projectPath) {
    return join(this.getHistoryDir(projectPath), 'terminals.json')
  }

  saveTerminals(projectPath, terminals) {
    try {
      const historyDir = this.getHistoryDir(projectPath)
      if (!existsSync(historyDir)) {
        mkdirSync(historyDir, { recursive: true })
      }
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      writeFileSync(terminalsFile, JSON.stringify({ projectPath, terminals }), 'utf-8')
    } catch (e) {
      console.error(`Failed to save terminals:`, e)
    }
  }

  loadTerminals(projectPath) {
    try {
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      if (!existsSync(terminalsFile)) {
        return []
      }
      const content = readFileSync(terminalsFile, 'utf-8')
      const data = JSON.parse(content)
      return data.terminals || []
    } catch (e) {
      console.error(`Failed to load terminals:`, e)
      return []
    }
  }

  clearTerminals(projectPath) {
    try {
      const terminalsFile = this.getTerminalsFilePath(projectPath)
      if (existsSync(terminalsFile)) {
        unlinkSync(terminalsFile)
      }
    } catch (e) {
      console.error(`Failed to clear terminals:`, e)
    }
  }

  async readFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return content
    } catch (e) {
      console.error(`Failed to read file ${filePath}:`, e)
      throw e
    }
  }

  async writeFile(filePath, content) {
    try {
      writeFileSync(filePath, content, 'utf-8')
      console.log(`Wrote file: ${filePath}`)
    } catch (e) {
      console.error(`Failed to write file ${filePath}:`, e)
      throw e
    }
  }

  async searchInDirectory(dirPath, query, maxResults = 100) {
    const results = []

    const isBinaryFile = (filename) => {
      const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z']
      const ext = filename.toLowerCase()
      return binaryExtensions.some(e => ext.endsWith(e))
    }

    const searchRecursive = async (currentPath, depth = 0) => {
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

  async searchFileContent(dirPath, query, maxResults = 100) {
    const results = []

    const isBinaryFile = (filename) => {
      const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z']
      const ext = filename.toLowerCase()
      return binaryExtensions.some(e => ext.endsWith(e))
    }

    const getSearchPreview = (lines, matchLine, query) => {
      const start = Math.max(0, matchLine - 1)
      const end = Math.min(lines.length - 1, matchLine + 1)
      const previewLines = []

      for (let i = start; i <= end; i++) {
        const lineNum = i + 1
        const line = lines[i]
        const displayLine = line.length > 120 ? line.substring(0, 120) + '...' : line
        previewLines.push(`${lineNum}: ${displayLine}`)
      }

      return previewLines.join('\n')
    }

    const searchRecursive = async (currentPath, depth = 0) => {
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
              if (isBinaryFile(entry)) continue

              const content = readFileSync(fullPath, 'utf-8')
              const lines = content.split('\n')

              for (let i = 0; i < lines.length; i++) {
                if (results.length >= maxResults) break
                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                  const preview = getSearchPreview(lines, i, query)
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

  execCommand(command, cwd) {
    try {
      const output = execSync(command, {
        cwd,
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024
      })
      return { success: true, output }
    } catch (e) {
      return { success: false, output: e.stdout || '', error: e.message }
    }
  }
}
