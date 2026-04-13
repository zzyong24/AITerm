import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export class PtyService extends EventEmitter {
  constructor() {
    super()
    this.sessions = new Map()
    console.log('PtyService initialized')
  }

  async createSession(projectId, projectName, workingDir) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
    const cwd = workingDir || this.getHomeDir()

    console.log(`Creating PTY session: shell=${shell}, cwd=${cwd}`)

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        ...process.env,
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

  async close(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        session.pty.kill()
        this.sessions.delete(sessionId)
        console.log(`Closed session ${sessionId}`)
      } catch (e) {
        console.error(`Failed to close session ${sessionId}:`, e)
      }
    }
  }

  closeAll() {
    for (const [sessionId, session] of this.sessions) {
      try {
        session.pty.kill()
        console.log(`Closed session ${sessionId}`)
      } catch (e) {
        console.error(`Failed to close session ${sessionId}:`, e)
      }
    }
    this.sessions.clear()
  }

  listSessions() {
    return Array.from(this.sessions.values()).map((s) => s.info)
  }

  getHomeDir() {
    return process.env.HOME || process.env.USERPROFILE || '/tmp'
  }
}
