import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { dirname } from 'path'
import { existsSync } from 'fs'

export class PtyService extends EventEmitter {
  constructor() {
    super()
    this.sessions = new Map()
    console.log('PtyService initialized')
  }

  async createSession(projectId, projectName, workingDir) {
    // macOS 默认是 zsh，优先使用 zsh
    const isWin = process.platform === 'win32'
    const shell = isWin ? 'powershell.exe' :
                   process.platform === 'darwin' ? '/bin/zsh' :
                   (process.env.SHELL || 'bash')
    let cwd = workingDir || this.getHomeDir()
    if (!existsSync(cwd)) {
      console.warn(`[PtyService] cwd does not exist: ${cwd}, falling back to home dir`)
      cwd = this.getHomeDir()
    }

    console.log(`Creating PTY session: shell=${shell}, cwd=${cwd}`)

    // 确保 PATH 包含用户日常使用的路径，特别是 Claude 安装位置
    const shellEnv = this.getShellEnv()

    // 使用交互式 shell 启动，确保 source ~/.zshrc（macOS 用户通常在这里配置 Claude）
    // -i 表示交互式 shell；Windows PowerShell 不支持该参数，传空数组
    const shellArgs = isWin ? [] : ['-i']
    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        ...shellEnv,
        TERM: 'xterm-256color',
        LANG: 'zh_CN.UTF-8'
      }
    })

    const sessionId = uuidv4()

    this.sessions.set(sessionId, {
      id: sessionId,
      pty: ptyProcess,
      info: {
        id: sessionId,
        projectId,
        projectName,
        workingDir: cwd
      },
      lastActivity: new Date()
    })

    ptyProcess.onData((data) => {
      const bytes = Buffer.from(data).length
      this.emit('output', {
        session_id: sessionId,
        data: Array.from(Buffer.from(data, 'utf-8'))
      })
      this.emit('activity', {
        session_id: sessionId,
        bytes
      })
      const session = this.sessions.get(sessionId)
      if (session) {
        session.lastActivity = new Date()
      }
    })

    ptyProcess.onExit((exitData) => {
      console.log(`PTY session ${sessionId} exited with code ${exitData.exitCode}`)
      this.emit('closed', { session_id: sessionId })
      this.sessions.delete(sessionId)
    })

    console.log(`PTY session ${sessionId} created successfully`)
    return sessionId
  }

  write(sessionId, data) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pty.write(data)
      session.lastActivity = new Date()
    } else {
      console.warn(`Attempted to write to non-existent session: ${sessionId}`)
    }
  }

  resize(sessionId, rows, cols) {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        session.pty.resize(cols, rows)
        console.log(`Resized session ${sessionId} to ${cols}x${rows}`)
      } catch (e) {
        console.error(`Failed to resize session ${sessionId}:`, e)
      }
    }
  }

  killProcessTree(pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /T /F /PID ${pid}`)
      } else {
        // 使用 process group 方式杀灭整个进程组
        // 先获取进程组 ID (pgid)，然后杀整个组
        let pgid = pid
        try {
          const pgidOutput = execSync(`ps -o pgid= -p ${pid} 2>/dev/null | head -1`).toString().trim()
          if (pgidOutput) {
            pgid = parseInt(pgidOutput, 10)
          }
        } catch (e) {
          // use original pid
        }

        // 杀整个进程组 (使用负的 pgid)
        try {
          process.kill(-pgid, 'SIGKILL')
        } catch (e) {
          // 如果进程组杀失败，尝试逐个杀
          this.killAllDescendants(pid)
        }
      }
    } catch (e) {
      console.warn(`Failed to kill process tree for ${pid}:`, e)
    }
  }

  killAllDescendants(pid) {
    try {
      // 获取所有后代进程 (包括孙进程)
      const output = execSync(`ps -o pid=,ppid= -A 2>/dev/null | awk '{print $1","$2}'`).toString()
      const processes = []
      output.trim().split('\n').forEach(line => {
        const parts = line.trim().split(',')
        if (parts.length === 2) {
          const p = parseInt(parts[0], 10)
          const pp = parseInt(parts[1], 10)
          if (!isNaN(p) && !isNaN(pp)) {
            processes.push({ pid: p, ppid: pp })
          }
        }
      })

      // 构建进程树，找到 pid 的所有后代
      const descendants = new Set()
      const findDescendants = (parentPid) => {
        processes.forEach(p => {
          if (p.ppid === parentPid && !descendants.has(p.pid)) {
            descendants.add(p.pid)
            findDescendants(p.pid)
          }
        })
      }
      findDescendants(pid)

      // 从最深的后代开始杀
      const sortedDescendants = Array.from(descendants).sort((a, b) => {
        // 按 PID 倒序，这样子进程会在父进程之前被杀掉
        return b - a
      })

      for (const childPid of sortedDescendants) {
        try {
          process.kill(childPid, 'SIGKILL')
        } catch (e2) {
          // ignore - 进程可能已经退出
        }
      }

      // 最后杀父进程
      try {
        process.kill(pid, 'SIGKILL')
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.warn(`Failed to kill descendants for ${pid}:`, e)
    }
  }

  async close(sessionId) {
    console.log('[PtyService] close called', { sessionId, sessionsCount: this.sessions.size })
    const session = this.sessions.get(sessionId)
    if (session) {
      console.log('[PtyService] session found, killing...', { sessionId, pid: session.pty.pid })
      try {
        // 先杀灭整个进程树，防止子进程（如 dev server）残留
        this.killProcessTree(session.pty.pid)
        try {
          session.pty.kill('SIGKILL')
        } catch (e) {
          console.warn('[PtyService] pty.kill error:', e)
        }
        console.log(`Closed session ${sessionId}`)
        console.log('[PtyService] session killed successfully', { sessionId })
      } catch (e) {
        console.error('[PtyService] error closing session:', { sessionId, error: e })
      } finally {
        this.sessions.delete(sessionId)
        console.log('[PtyService] session deleted from map', { sessionId, remainingSessions: this.sessions.size })
      }
    } else {
      console.warn('[PtyService] session not found in map', { sessionId })
    }
  }

  closeAll() {
    return new Promise((resolve) => {
      const sessions = Array.from(this.sessions.entries())
      if (sessions.length === 0) {
        resolve()
        return
      }

      let completed = 0
      const checkDone = () => {
        completed++
        if (completed >= sessions.length) {
          this.sessions.clear()
          resolve()
        }
      }

      for (const [sessionId, session] of sessions) {
        try {
          // 先尝试优雅终止，给进程一个清理的机会
          try {
            process.kill(-session.pty.pid, 'SIGTERM')
          } catch (e) {
            // ignore
          }

          // 等待一小段时间让进程优雅退出
          setTimeout(() => {
            try {
              this.killProcessTree(session.pty.pid)
              session.pty.kill('SIGKILL')
            } catch (e) {
              // ignore - 进程可能已经退出
            }
            console.log(`Closed session ${sessionId}`)
            checkDone()
          }, 100)
        } catch (e) {
          console.warn(`Error closing session ${sessionId}:`, e)
          checkDone()
        }
      }
    })
  }

  listSessions() {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  getHomeDir() {
    return process.env.HOME || process.env.USERPROFILE || '/tmp'
  }

  getShellEnv() {
    const baseEnv = {}

    // 复制当前环境
    for (const key in process.env) {
      if (process.env[key] !== undefined) {
        baseEnv[key] = process.env[key]
      }
    }

    // Claude 通常安装在 ~/.claude/bin，需要确保 PATH 包含它
    const homeDir = this.getHomeDir()
    const claudeBinPath = `${homeDir}/.claude/bin`
    const localBinPath = `${homeDir}/.local/bin`

    // 获取 shell 所在目录并添加到 PATH
    const shell = process.env.SHELL || '/bin/bash'
    const shellDir = dirname(shell)

    // 构建完整的 PATH，包含所有必要目录
    const existingPath = baseEnv.PATH || ''
    const additionalPaths = [
      claudeBinPath,
      localBinPath,
      shellDir,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin'
    ].filter(p => p && !existingPath.split(':').includes(p))

    if (additionalPaths.length > 0) {
      baseEnv.PATH = [...additionalPaths, existingPath].filter(p => p).join(':')
    }

    // 确保 HOME 设置正确
    baseEnv.HOME = homeDir

    return baseEnv
  }
}
