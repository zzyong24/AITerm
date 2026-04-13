import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import log from 'electron-log'

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

  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        // 检查 PTY 是否已退出
        if ((session.pty as any).exitCode === null) {
          session.pty.kill()
        }
        log.info(`Closed session ${sessionId}`)
      } catch (e) {
        log.warn(`Error closing session ${sessionId}:`, e)
      } finally {
        this.sessions.delete(sessionId)
      }
    }
  }

  closeAll(): void {
    for (const [sessionId, session] of this.sessions) {
      try {
        if ((session.pty as any).exitCode === null) {
          session.pty.kill()
        }
        log.info(`Closed session ${sessionId}`)
      } catch (e) {
        log.warn(`Error closing session ${sessionId}:`, e)
      }
    }
    this.sessions.clear()
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
