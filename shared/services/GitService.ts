import simpleGit, { SimpleGit } from 'simple-git'

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  created: string[]
  deleted: string[]
  renamed: string[]
  conflicted: string[]
  isRepo: boolean
}

export interface GitOperationResult {
  success: boolean
  message: string
}

export class GitService {
  private logHandler: ((msg: string) => void) | null = null

  setLogger(logger: (msg: string) => void) {
    this.logHandler = logger
  }

  private log(msg: string) {
    if (this.logHandler) {
      this.logHandler(msg)
    }
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const isRepo = await git.checkIsRepo()

      if (!isRepo) {
        return {
          branch: '',
          ahead: 0,
          behind: 0,
          staged: [],
          modified: [],
          untracked: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          isRepo: false
        }
      }

      const [status, branchSummary] = await Promise.all([
        git.status(),
        git.branchLocal()
      ])

      return {
        branch: branchSummary.current || '',
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        created: status.created,
        deleted: status.deleted,
        renamed: (status.renamed || []).map((r: any) => r.to || r.from),
        conflicted: status.conflicted,
        isRepo: true
      }
    } catch (e) {
      this.log(`Failed to get git status for ${repoPath}: ${e}`)
      return {
        branch: '',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
        isRepo: false
      }
    }
  }

  async stageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.add(filePath)
      this.log(`Staged file: ${filePath}`)
      return { success: true, message: `已暂存文件: ${filePath}` }
    } catch (e: any) {
      this.log(`Failed to stage file ${filePath}: ${e}`)
      return { success: false, message: `暂存失败: ${e?.message || e}` }
    }
  }

  async stageAll(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.add('.')
      this.log(`Staged all changes in: ${repoPath}`)
      return { success: true, message: '已暂存所有更改' }
    } catch (e: any) {
      this.log(`Failed to stage all: ${e}`)
      return { success: false, message: `暂存失败: ${e?.message || e}` }
    }
  }

  async unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.reset(['HEAD', '--', filePath])
      this.log(`Unstaged file: ${filePath}`)
      return { success: true, message: `已取消暂存文件: ${filePath}` }
    } catch (e: any) {
      this.log(`Failed to unstage file ${filePath}: ${e}`)
      return { success: false, message: `取消暂存失败: ${e?.message || e}` }
    }
  }

  async commit(repoPath: string, message: string, files: string[] = []): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      for (const file of files) {
        if (file) {
          const absPath = file.startsWith('/') ? file : (repoPath.endsWith('/') ? repoPath + file : repoPath + '/' + file)
          await git.add(absPath)
        }
      }
      const result = await git.commit(message)
      if (!result.commit || result.summary.changes === 0) {
        return { success: false, message: '没有要提交的更改，请先暂存文件' }
      }
      this.log(`Committed with message: ${message}`)
      return { success: true, message: '提交成功' }
    } catch (e: any) {
      this.log(`Failed to commit: ${e}`)
      return { success: false, message: `提交失败: ${e?.message || e}` }
    }
  }

  async push(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.push()
      this.log(`Pushed to remote: ${repoPath}`)
      return { success: true, message: '推送成功' }
    } catch (e: any) {
      this.log(`Failed to push: ${e}`)
      return { success: false, message: `推送失败: ${e?.message || e}` }
    }
  }

  async pull(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.pull()
      this.log(`Pulled from remote: ${repoPath}`)
      return { success: true, message: '拉取成功' }
    } catch (e: any) {
      this.log(`Failed to pull: ${e}`)
      return { success: false, message: `拉取失败: ${e?.message || e}` }
    }
  }

  async discardChanges(repoPath: string, filePath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.checkout(['--', filePath])
      this.log(`Discarded changes for: ${filePath}`)
      return { success: true, message: `已丢弃更改: ${filePath}` }
    } catch (e: any) {
      this.log(`Failed to discard changes for ${filePath}: ${e}`)
      return { success: false, message: `丢弃更改失败: ${e?.message || e}` }
    }
  }

  async getStatusBrief(repoPath: string): Promise<{ isRepo: boolean; changesCount: number; rootPath?: string }> {
    try {
      const git: SimpleGit = simpleGit(repoPath, { timeout: { block: 2000 } })
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return { isRepo: false, changesCount: 0 }
      const rootPath = await git.revparse(['--show-toplevel'])
      // 使用更轻量的 git status --short
      const statusOutput = await git.raw(['status', '--short', '--untracked-files=all'])
      const count = statusOutput.trim() ? statusOutput.trim().split('\n').length : 0
      return { isRepo: true, changesCount: count, rootPath }
    } catch (e) {
      this.log(`Failed to get git status brief for ${repoPath}: ${e}`)
      return { isRepo: false, changesCount: 0 }
    }
  }

  async getRemote(repoPath: string): Promise<{ remote: string; remoteUrl: string }> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const remotes = await git.getRemotes()
      if (remotes.length === 0) return { remote: '', remoteUrl: '' }
      const origin = remotes.find(r => r.name === 'origin') || remotes[0]

      let remoteUrl = (origin as any).refs?.fetch || ''
      if (!remoteUrl) {
        try {
          const url = await git.remote(['get-url', origin.name])
          remoteUrl = (url || '').trim()
        } catch {
          remoteUrl = ''
        }
      }

      return { remote: origin.name, remoteUrl }
    } catch (e) {
      this.log(`Failed to get remote for ${repoPath}: ${e}`)
      return { remote: '', remoteUrl: '' }
    }
  }

  async getLastCommit(repoPath: string): Promise<{ hash: string; date: string; message: string }> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const log = await git.log({ maxCount: 1 })
      if (!log.all || log.all.length === 0) return { hash: '', date: '', message: '' }
      const commit = log.all[0]
      return {
        hash: commit.hash,
        date: commit.date,
        message: commit.message
      }
    } catch (e) {
      this.log(`Failed to get last commit for ${repoPath}: ${e}`)
      return { hash: '', date: '', message: '' }
    }
  }
}
