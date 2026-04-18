import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'
import { execSync } from 'child_process'

export interface SessionInfo {
  id: string
  projectId: string | null
  projectName: string | null
  workingDir: string
}

interface PtySession {
  id: string
  pty: pty.IPty
  info: SessionInfo
  lastActivity: Date
}

export class PtyService extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map()

  constructor() {
    super()
    log.info('PtyService initialized')
  }

  async createSession(
    projectId: string | null,
    projectName: string | null,
    workingDir: string | null
  ): Promise<string> {
    // macOS 默认是 zsh，优先使用 zsh
    const shell = process.platform === 'win32' ? 'powershell.exe' :
                   process.platform === 'darwin' ? '/bin/zsh' :
                   (process.env.SHELL || 'bash')
    const cwd = workingDir || this.getHomeDir()

    // 确保 PATH 包含用户日常使用的路径，特别是 Claude 安装位置
    const shellEnv = this.getShellEnv()

    log.info(`Creating PTY session: shell=${shell}, cwd=${cwd}`)
    log.info(`Shell env PATH: ${shellEnv.PATH}`)

    // 使用交互式 shell 启动，确保 source ~/.zshrc（macOS 用户通常在这里配置 Claude）
    // -i 表示交互式 shell
    const ptyProcess = pty.spawn(shell, ['-i'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        ...shellEnv,
        TERM: 'xterm-256color',
        LANG: 'zh_CN.UTF-8'
      } as Record<string, string>
    })

    const sessionId = uuidv4()
    const info: SessionInfo = {
      id: sessionId,
      projectId,
      projectName,
      workingDir: cwd
    }

    this.sessions.set(sessionId, {
      id: sessionId,
      pty: ptyProcess,
      info,
      lastActivity: new Date()
    })

    ptyProcess.onData((data: string) => {
      const bytes = Buffer.from(data).length
      this.emit('output', {
        session_id: sessionId,
        data: Array.from(Buffer.from(data, 'utf-8'))
      })
      this.emit('activity', {
        session_id: sessionId,
        bytes
      })
      this.sessions.get(sessionId)!.lastActivity = new Date()
    })

    ptyProcess.onExit((exitData: { exitCode: number; signal?: number }) => {
      log.info(`PTY session ${sessionId} exited with code ${exitData.exitCode}`)
      this.emit('closed', { session_id: sessionId })
      this.sessions.delete(sessionId)
    })

    log.info(`PTY session ${sessionId} created successfully`)
    return sessionId
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pty.write(data)
      session.lastActivity = new Date()
    } else {
      log.warn(`Attempted to write to non-existent session: ${sessionId}`)
    }
  }

  resize(sessionId: string, rows: number, cols: number): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        session.pty.resize(cols, rows)
        log.info(`Resized session ${sessionId} to ${cols}x${rows}`)
      } catch (e) {
        log.error(`Failed to resize session ${sessionId}:`, e)
      }
    }
  }

  private killProcessTree(pid: number): void {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /T /F /PID ${pid}`)
      } else {
        // 使用 process group 方式杀灭整个进程组
        // 先获取进程组 ID (pgid)，然后杀整个组
        let pgid: number = pid
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
          try {
            process.kill(pid, 'SIGKILL')
          } catch (e2) {
            // ignore
          }
        }
      }
    } catch (e) {
      log.warn(`Failed to kill process tree for ${pid}:`, e)
    }
  }

  private killAllDescendants(pid: number): void {
    try {
      // 获取所有后代进程 (包括孙进程)
      const output = execSync(`ps -o pid=,ppid= -A 2>/dev/null | awk '{print $1","$2}'`).toString()
      const processes: { pid: number; ppid: number }[] = []
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
      const descendants = new Set<number>()
      const findDescendants = (parentPid: number) => {
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
        } catch (e) {
          // ignore - 进程可能已经退出
        }
      }
    } catch (e) {
      log.warn(`Failed to kill descendants for ${pid}:`, e)
    }
  }

  async close(sessionId: string): Promise<void> {
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
        log.info(`Closed session ${sessionId}`)
        console.log('[PtyService] session killed successfully', { sessionId })
      } catch (e) {
        log.warn(`Error closing session ${sessionId}:`, e)
        console.error('[PtyService] error closing session:', { sessionId, error: e })
      } finally {
        this.sessions.delete(sessionId)
        console.log('[PtyService] session deleted from map', { sessionId, remainingSessions: this.sessions.size })
      }
    } else {
      console.warn('[PtyService] session not found in map', { sessionId })
    }
  }

  closeAll(): Promise<void> {
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
            log.info(`Closed session ${sessionId}`)
            checkDone()
          }, 100)
        } catch (e) {
          log.warn(`Error closing session ${sessionId}:`, e)
          checkDone()
        }
      }
    })
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  private getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || '/tmp'
  }

  private getShellEnv(): Record<string, string> {
    const baseEnv: Record<string, string> = {}

    // 复制当前环境
    for (const key in process.env) {
      if (process.env[key] !== undefined) {
        baseEnv[key] = process.env[key]!
      }
    }

    // Claude 通常安装在 ~/.claude/bin，需要确保 PATH 包含它
    const homeDir = this.getHomeDir()
    const claudeBinPath = `${homeDir}/.claude/bin`
    const localBinPath = `${homeDir}/.local/bin`

    // 获取 shell 所在目录并添加到 PATH
    const shell = process.env.SHELL || '/bin/bash'
    const shellDir = require('path').dirname(shell)

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
