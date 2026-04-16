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
        renamed: (status.renamed || []).map(r => r.to || r.from),
        conflicted: status.conflicted,
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
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
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

  async stageFile(repoPath, filePath) {
    try {
      const git = simpleGit(repoPath)
      await git.add(filePath)
      return { success: true, message: `已暂存文件: ${filePath}` }
    } catch (e) {
      return { success: false, message: `暂存失败: ${e.message}` }
    }
  }

  async commit(repoPath, message, files = []) {
    try {
      const git = simpleGit(repoPath)
      for (const file of files) {
        if (file) await git.add(file)
      }
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

  async getStatusBrief(repoPath) {
    try {
      const git = simpleGit(repoPath, { timeout: { block: 2000 } })
      const isRepo = await git.checkIsRepo()
      if (!isRepo) return { isRepo: false, changesCount: 0 }
      const rootPath = await git.revparse(['--show-toplevel'])
      // 使用更轻量的 git status --short 并限制未跟踪文件数量
      const statusOutput = await git.raw(['status', '--short', '--untracked-files=all'])
      const count = statusOutput.trim() ? statusOutput.trim().split('\n').length : 0
      return { isRepo: true, changesCount: count, rootPath }
    } catch (e) {
      console.error(`Failed to get git status brief for ${repoPath}:`, e)
      return { isRepo: false, changesCount: 0 }
    }
  }

  async getRemote(repoPath) {
    try {
      const git = simpleGit(repoPath)
      const remotes = await git.getRemotes()
      if (remotes.length === 0) return { remote: '', remoteUrl: '' }
      const origin = remotes.find(r => r.name === 'origin') || remotes[0]

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
      console.error(`Failed to get remote for ${repoPath}:`, e)
      return { remote: '', remoteUrl: '' }
    }
  }

  async getLastCommit(repoPath) {
    try {
      const git = simpleGit(repoPath)
      const log = await git.log({ maxCount: 1 })
      if (!log.all || log.all.length === 0) return { hash: '', date: '', message: '' }
      const commit = log.all[0]
      return {
        hash: commit.hash,
        date: commit.date,
        message: commit.message
      }
    } catch (e) {
      console.error(`Failed to get last commit for ${repoPath}:`, e)
      return { hash: '', date: '', message: '' }
    }
  }
}
