import simpleGit, { SimpleGit } from 'simple-git'
import log from 'electron-log'

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
      log.error(`Failed to get git status for ${repoPath}:`, e)
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
      log.info(`Staged file: ${filePath}`)
      return { success: true, message: `已暂存文件: ${filePath}` }
    } catch (e) {
      log.error(`Failed to stage file ${filePath}:`, e)
      return { success: false, message: `暂存失败: ${e}` }
    }
  }

  async stageAll(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.add('.')
      log.info(`Staged all changes in: ${repoPath}`)
      return { success: true, message: '已暂存所有更改' }
    } catch (e) {
      log.error(`Failed to stage all:`, e)
      return { success: false, message: `暂存失败: ${e}` }
    }
  }

  async unstageFile(repoPath: string, filePath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.reset(['HEAD', '--', filePath])
      log.info(`Unstaged file: ${filePath}`)
      return { success: true, message: `已取消暂存文件: ${filePath}` }
    } catch (e) {
      log.error(`Failed to unstage file ${filePath}:`, e)
      return { success: false, message: `取消暂存失败: ${e}` }
    }
  }

  async commit(repoPath: string, message: string, files: string[] = []): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      for (const file of files) {
        const absPath = file.startsWith('/') ? file : (repoPath.endsWith('/') ? repoPath + file : repoPath + '/' + file)
        await git.add(absPath)
      }
      const result = await git.commit(message)
      // 只提取可序列化的基本数据，避免返回包含不可序列化属性的对象
      const commitHash = typeof result.commit === 'string' ? result.commit : String(result.commit || '')
      const changesCount = typeof result.summary?.changes === 'number' ? result.summary.changes : 0

      if (!commitHash || changesCount === 0) {
        return { success: false, message: '没有要提交的更改，请先暂存文件' }
      }
      log.info(`Committed with message: ${message}`)
      return { success: true, message: `已提交: ${message}` }
    } catch (e: any) {
      log.error(`Failed to commit:`, e)
      const errorMessage = e?.message || String(e || '未知错误')
      return { success: false, message: `提交失败: ${errorMessage}` }
    }
  }

  async push(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.push()
      log.info(`Pushed to remote: ${repoPath}`)
      return { success: true, message: '已推送到远程仓库' }
    } catch (e) {
      log.error(`Failed to push:`, e)
      return { success: false, message: `推送失败: ${e}` }
    }
  }

  async pull(repoPath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.pull()
      log.info(`Pulled from remote: ${repoPath}`)
      return { success: true, message: '已从远程仓库拉取' }
    } catch (e) {
      log.error(`Failed to pull:`, e)
      return { success: false, message: `拉取失败: ${e}` }
    }
  }

  async discardChanges(repoPath: string, filePath: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      await git.checkout(['--', filePath])
      log.info(`Discarded changes for: ${filePath}`)
      return { success: true, message: `已丢弃更改: ${filePath}` }
    } catch (e) {
      log.error(`Failed to discard changes for ${filePath}:`, e)
      return { success: false, message: `丢弃更改失败: ${e}` }
    }
  }

  async getStatusBrief(repoPath: string): Promise<{ isRepo: boolean; changesCount: number; rootPath?: string }> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return { isRepo: false, changesCount: 0 }
      const rootPath = await git.revparse(['--show-toplevel'])
      const status = await git.status()
      const count = (status.staged?.length || 0) +
        (status.modified?.length || 0) +
        (status.not_added?.length || 0) +
        (status.created?.length || 0) +
        (status.deleted?.length || 0) +
        ((status.renamed || []).length || 0) +
        (status.conflicted?.length || 0)
      return { isRepo: true, changesCount: count, rootPath }
    } catch (e) {
      log.error(`Failed to get git status brief for ${repoPath}:`, e)
      return { isRepo: false, changesCount: 0 }
    }
  }

  async getRemote(repoPath: string): Promise<{ remote: string; remoteUrl: string }> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const remotes = await git.getRemotes(true)
      if (remotes.length === 0) return { remote: '', remoteUrl: '' }
      const origin = remotes.find(r => r.name === 'origin') || remotes[0]

      // Try to get URL using remote command
      let remoteUrl = origin.refs?.fetch || ''
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
      log.error(`Failed to get remote for ${repoPath}:`, e)
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
      log.error(`Failed to get last commit for ${repoPath}:`, e)
      return { hash: '', date: '', message: '' }
    }
  }
}
