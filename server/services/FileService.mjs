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
        if (!showHidden && (name.startsWith('.') || name === 'node_modules')) {
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
