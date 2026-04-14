import simpleGit, { SimpleGit } from 'simple-git'
import log from 'electron-log'

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
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

  async commit(repoPath: string, message: string): Promise<GitOperationResult> {
    try {
      const git: SimpleGit = simpleGit(repoPath)
      const result = await git.commit(message)
      if (!result.commit || result.summary.changes === 0) {
        return { success: false, message: '没有要提交的更改，请先暂存文件' }
      }
      log.info(`Committed with message: ${message}`)
      return { success: true, message: `已提交: ${message}` }
    } catch (e) {
      log.error(`Failed to commit:`, e)
      return { success: false, message: `提交失败: ${e}` }
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
}
