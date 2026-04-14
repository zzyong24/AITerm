import simpleGit from 'simple-git'

export class GitService {
  async getStatus(repoPath) {
    try {
      const git = simpleGit(repoPath)
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
      console.error(`Failed to get git status for ${repoPath}:`, e)
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

  async stageAll(repoPath) {
    try {
      const git = simpleGit(repoPath)
      await git.add('.')
      return { success: true, message: '已暂存所有更改' }
    } catch (e) {
      return { success: false, message: `暂存失败: ${e.message}` }
    }
  }

  async commit(repoPath, message) {
    try {
      const git = simpleGit(repoPath)
      const result = await git.commit(message)
      if (!result.commit || result.summary.changes === 0) {
        return { success: false, message: '没有要提交的更改，请先暂存文件' }
      }
      return { success: true, message: '提交成功' }
    } catch (e) {
      return { success: false, message: `提交失败: ${e.message}` }
    }
  }

  async push(repoPath) {
    try {
      const git = simpleGit(repoPath)
      await git.push()
      return { success: true, message: '推送成功' }
    } catch (e) {
      return { success: false, message: `推送失败: ${e.message}` }
    }
  }

  async pull(repoPath) {
    try {
      const git = simpleGit(repoPath)
      await git.pull()
      return { success: true, message: '拉取成功' }
    } catch (e) {
      return { success: false, message: `拉取失败: ${e.message}` }
    }
  }
}
