import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import { execSync } from 'child_process'

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

  killProcessTree(pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /T /F /PID ${pid}`)
      } else {
        const killChildren = (parentPid) => {
          try {
            const output = execSync(`ps -o pid= -ppid ${parentPid}`).toString()
            const childPids = output.trim().split('\n').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
            for (const childPid of childPids) {
              killChildren(childPid)
              try {
                process.kill(childPid, 'SIGKILL')
              } catch (e) {
                // ignore
              }
            }
          } catch (e) {
            // no children
          }
        }
        killChildren(pid)
        try {
          process.kill(pid, 'SIGKILL')
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn(`Failed to kill process tree for ${pid}:`, e)
    }
  }

  async close(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        // 先杀灭整个进程树，防止子进程（如 dev server）残留
        this.killProcessTree(session.pty.pid)
        session.pty.kill()
        console.log(`Closed session ${sessionId}`)
      } catch (e) {
        console.error(`Failed to close session ${sessionId}:`, e)
      } finally {
        this.sessions.delete(sessionId)
      }
    }
  }

  closeAll() {
    for (const [sessionId, session] of this.sessions) {
      try {
        this.killProcessTree(session.pty.pid)
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
