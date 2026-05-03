<template>
  <div class="directory-tree">
    <a-spin v-if="loading && !treeData.length" size="small" class="tree-loading" />
    <a-tree v-if="treeData.length" :tree-data="treeData" :selected-keys="selectedKeys" :expanded-keys="expandedKeys"
      :auto-expand-parent="autoExpandParent" :show-line="{ showLeafIcon: false }" :load-data="onLoadData"
      :selected="selectedKeys.length > 0" @select="onSelect" @expand="onExpand">
      <template #title="{ dataRef }">
        <span class="tree-node-title" :class="{ 'git-ignored': dataRef.isGitIgnored }" :data-path="dataRef.path"
          @dblclick="(e) => onNodeDoubleClick(e, dataRef.path, dataRef.isDirectory)"
          @contextmenu="(e) => onNodeContextMenu(e, dataRef.path, dataRef.isDirectory)">
          {{ dataRef.title }}
          <span v-if="dataRef.hasGitDir" class="tree-git-icon-wrapper">
            <svg class="tree-git-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M13 6h3a2 2 0 0 1 2 2v7" />
              <path d="M6 9v12" />
            </svg>
            <span v-if="dataRef.gitRepo?.changesCount > 0" class="tree-git-badge">{{ dataRef.gitRepo.changesCount > 99 ?
              '99+' : dataRef.gitRepo.changesCount }}</span>
            <span v-if="(dataRef.gitRepo?.ahead || 0) > 0" class="tree-git-ahead" title="本地领先远程">↑{{ dataRef.gitRepo.ahead }}</span>
            <span v-if="(dataRef.gitRepo?.behind || 0) > 0" class="tree-git-behind" title="本地落后远程">↓{{ dataRef.gitRepo.behind }}</span>
          </span>
        </span>
      </template>
    </a-tree>

    <!-- 右键菜单 -->
    <div v-if="contextMenu.visible" class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
      <div class="context-menu-item" @click="handleOpenTerminal">打开到终端</div>
      <div class="context-menu-item" v-if="contextMenu.isDirectory" @click="handleSearchInDirectory">在目录中搜索</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" v-if="!contextMenu.isDirectory" @click="handleEditFile">编辑</div>
      <div class="context-menu-item" @click="handleOpenInEditor">在编辑器中打开</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="handleRefresh">刷新</div>
      <div class="context-menu-separator" v-if="contextMenu.isDirectory" />
      <div class="context-menu-item" v-if="contextMenu.isDirectory" @click="handleOpenCommitDialog">版本管理</div>
      <div class="context-menu-separator" v-if="contextMenu.isDirectory" />
      <div class="context-menu-item danger" @click="handleDelete">删除</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="handleCopyPath">复制路径</div>
    </div>

    <!-- 确认删除对话框 -->
    <div v-if="showConfirm" class="modal-overlay" @click="showConfirm = false">
      <div class="modal confirm-modal" @click.stop>
        <div class="modal-header">
          <span>确认删除</span>
          <button class="modal-close" @click="showConfirm = false">×</button>
        </div>
        <div class="modal-body">
          <p>确定要删除 "{{ pathToDelete }}" 吗？此操作不可恢复！</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showConfirm = false">取消</button>
          <button class="btn-confirm danger" @click="confirmDelete">删除</button>
        </div>
      </div>
    </div>

    <!-- 版本管理弹窗 -->
    <GitCommitDialog v-if="commitDialog.visible" :file-list="commitDialog.files" :loading="commitDialog.loading"
      :branch="commitDialog.branch" :remote="commitDialog.remote" :ahead="commitDialog.ahead"
      :behind="commitDialog.behind" :last-commit="commitDialog.lastCommit" :committing="commitDialog.committing"
      :too-many-files-count="commitDialog.tooManyFilesCount" @commit="handleCommitFiles"
      @cancel="commitDialog.visible = false" @pull="handleDialogPull" @push="handleDialogPush" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Tree } from 'ant-design-vue'
import {
  readDirectoryBatch,
  readFile as apiReadFile,
  openProjectInEditor as apiOpenProjectInEditor,
  deletePath as apiDeletePath,
  getGitRepoBrief,
  getGitStatus as apiGetGitStatus,
  getGitRemote,
  getGitLastCommit,
  gitStageFile as apiGitStageFile,
  gitCommit as apiGitCommit,
  gitPull as apiGitPull,
  gitPush as apiGitPush,
  startWatcher,
  stopWatcher,
  watcherAddListener,
  watcherUnlinkListener,
  watcherAddDirListener,
  watcherUnlinkDirListener,
  type WatcherEvent
} from '../api'
import { appBusiness } from '../store/AppBusiness'
import { alert } from '../plugins/MessageBox'
import GitCommitDialog, { type CommitFile } from './GitCommitDialog.vue'

interface TreeNode {
  title: string
  key: string
  path: string
  isDirectory: boolean
  isGitIgnored?: boolean
  hasGitDir?: boolean
  gitRepo?: { isRepo: boolean; changesCount: number; ahead?: number; behind?: number }
  children?: TreeNode[]
  loading?: boolean
  isLeaf?: boolean
}

export default defineComponent({
  name: 'DirectoryTree',

  components: {
    'a-tree': Tree,
    GitCommitDialog
  },

  expose: ['loadTree'],

  props: {
    rootPath: {
      type: String,
      required: true
    }
  },

  emits: ['node-click', 'open-editor', 'open-terminal', 'search-in-directory', 'refresh'],

  data() {
    return {
      treeData: [] as TreeNode[],
      selectedKeys: [] as string[],
      expandedKeys: [] as string[],
      autoExpandParent: true,
      loading: false,
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        path: '',
        isDirectory: false
      },
      showConfirm: false,
      pathToDelete: '',
      commitDialog: {
        visible: false,
        loading: false,
        committing: false,
        repoPath: '',
        dirPath: '',
        files: [] as CommitFile[],
        branch: '',
        remote: '',
        ahead: 0,
        behind: 0,
        lastCommit: null as { hash: string; date: string; message: string } | null,
        tooManyFilesCount: 0
      },
      // 文件监听器引用
      watcherCleanups: [] as (() => void)[],
      // watcher 事件防抖
      pendingWatcherEvents: [] as Array<{ type: 'add' | 'unlink' | 'addDir' | 'unlinkDir', data: WatcherEvent }>,
      watcherDebounceTimer: null as ReturnType<typeof setTimeout> | null,
      // 路径索引 Map：O(1) 查找节点，避免每次递归遍历整棵树
      pathIndex: new Map<string, TreeNode>() as Map<string, TreeNode>
    }
  },

  mounted() {
    this.loadTree()

    window.addEventListener('click', this.closeContextMenu)

    // TODO: watcher 功能暂停，重新设计后启用
    // this.setupWatcher()
  },

  beforeUnmount() {
    window.removeEventListener('click', this.closeContextMenu)
    // this.cleanupWatcher()
  },

  methods: {
    // 构建路径索引，支持 O(1) 查找节点
    buildPathIndex() {
      this.pathIndex.clear()
      const traverse = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          this.pathIndex.set(node.path, node)
          if (node.children) traverse(node.children)
        }
      }
      traverse(this.treeData)
    },

    async setupWatcher() {
      // 计算 projectPath（取 rootPath 的父目录作为 project 标识）
      const projectPath = this.rootPath
      try {
        await startWatcher(projectPath, this.rootPath)

        const cleanups = [
          watcherAddListener((data) => this.handleWatcherEvent('add', data)),
          watcherUnlinkListener((data) => this.handleWatcherEvent('unlink', data)),
          watcherAddDirListener((data) => this.handleWatcherEvent('addDir', data)),
          watcherUnlinkDirListener((data) => this.handleWatcherEvent('unlinkDir', data))
        ]
        this.watcherCleanups = cleanups
      } catch (e) {
        console.error('Failed to start watcher:', e)
      }
    },

    cleanupWatcher() {
      for (const cleanup of this.watcherCleanups) {
        cleanup()
      }
      this.watcherCleanups = []
      if (this.watcherDebounceTimer !== null) {
        clearTimeout(this.watcherDebounceTimer)
        this.watcherDebounceTimer = null
      }
      this.pendingWatcherEvents = []
      stopWatcher(this.rootPath).catch(() => {})
    },

    handleWatcherEvent(type: 'add' | 'unlink' | 'addDir' | 'unlinkDir', data: WatcherEvent) {
      // 只处理属于本 rootPath 的事件
      if (data.projectPath !== this.rootPath) return

      this.pendingWatcherEvents.push({ type, data })

      if (this.watcherDebounceTimer === null) {
        this.watcherDebounceTimer = setTimeout(() => {
          this.flushWatcherEvents()
        }, 500)
      }
    },

    flushWatcherEvents() {
      this.watcherDebounceTimer = null
      const events = this.pendingWatcherEvents
      this.pendingWatcherEvents = []

      for (const { type, data } of events) {
        // 使用 pathIndex O(1) 查找，不再递归遍历
        const parentNode = this.pathIndex.get(data.parentPath)
        if (!parentNode) continue

        if (!parentNode.children) {
          parentNode.children = []
        }

        if (type === 'add' || type === 'addDir') {
          const exists = parentNode.children.some(c => c.title === data.name)
          if (exists) continue
          this.insertNode(parentNode, data.name, data.isDirectory)
        } else {
          this.removeNodeByName(parentNode, data.name)
        }
      }

      if (events.length > 0) {
        this.treeData = [...this.treeData]
        this.buildPathIndex()
      }
    },

    findTreeNodeByPath(tree: TreeNode[], path: string): TreeNode | null {
      for (const node of tree) {
        if (node.path === path) return node
        if (node.children) {
          const found = this.findTreeNodeByPath(node.children, path)
          if (found) return found
        }
      }
      return null
    },

    insertNode(parentNode: TreeNode, name: string, isDirectory: boolean) {
      if (!parentNode.children) {
        parentNode.children = []
      }
      const newNode: TreeNode = {
        title: name,
        key: `${parentNode.path}/${name}`,
        path: `${parentNode.path}/${name}`,
        isDirectory,
        children: isDirectory ? [] : undefined,
        isLeaf: !isDirectory
      }
      parentNode.children.push(newNode)
      // 保持排序：目录在前
      parentNode.children.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.title.localeCompare(b.title)
      })
    },

    removeNodeByName(parentNode: TreeNode, name: string) {
      if (!parentNode.children) return
      const idx = parentNode.children.findIndex(c => c.title === name)
      if (idx >= 0) {
        parentNode.children.splice(idx, 1)
      }
    },

    async loadTree() {
      this.loading = true
      try {
        const children = await this.readDirectory(this.rootPath)
        this.treeData = children
        this.buildPathIndex()
        this.expandedKeys = []
        // 非阻塞刷新直接下级的 git 角标
        if (children.length > 0) {
          this.refreshChildrenGitStatus(children)
        }
      } catch (e) {
        console.error('Failed to load tree:', e)
      } finally {
        this.loading = false
      }
    },

    async readDirectory(dirPath: string): Promise<TreeNode[]> {
      try {
        const entries = await readDirectoryBatch(dirPath, true)

        return entries.map(entry => ({
          title: entry.name,
          key: entry.path,
          path: entry.path,
          isDirectory: entry.isDirectory,
          isGitIgnored: entry.isGitIgnored,
          hasGitDir: entry.hasGitDir,
          children: entry.isDirectory ? [] : undefined,
          isLeaf: !entry.isDirectory
        }))
      } catch (e) {
        console.error('Failed to read directory:', e)
        return []
      }
    },

    onSelect(selectedKeys: any, e: any) {
      if (e.node.isLeaf) {
        this.$emit('node-click', e.node.path)
      }
      this.selectedKeys = selectedKeys
    },

    onExpand(expandedKeys: any, e: any) {
      this.expandedKeys = expandedKeys
      this.autoExpandParent = false

      // 展开目录时刷新下级目录的 git 角标（非阻塞）
      const expandedPath = e.node?.dataRef?.path
      if (expandedPath) {
        const node = this.findTreeNodeByPath(this.treeData, expandedPath)
        if (node && node.children && node.children.length > 0) {
          this.refreshChildrenGitStatus(node.children)
        }
      }
    },

    async refreshChildrenGitStatus(children: TreeNode[]) {
      const gitChildren = children.filter((c) => c.hasGitDir)
      if (gitChildren.length === 0) return

      await Promise.all(
        gitChildren.map(async (child) => {
          try {
            const brief = await getGitRepoBrief(child.path)
            child.gitRepo = brief.isRepo ? brief : undefined
          } catch (e) {
            child.gitRepo = undefined
          }
        })
      )
      this.treeData = [...this.treeData]
    },

    onLoadData(treeNode: any) {
      return new Promise<void>(async (resolve) => {
        if (treeNode.dataRef.children && treeNode.dataRef.children.length > 0) {
          resolve()
          return
        }

        const children = await this.readDirectory(treeNode.dataRef.path)
        treeNode.dataRef.children = children
        this.treeData = [...this.treeData]
        this.buildPathIndex()

        // 延迟加载子目录的 git 状态（不阻塞展开）
        const gitDirs = children.filter((c: TreeNode) => c.hasGitDir)
        if (gitDirs.length > 0) {
          Promise.all(
            gitDirs.map(async (node: TreeNode) => {
              try {
                const brief = await getGitRepoBrief(node.path)
                if (brief.isRepo) {
                  node.gitRepo = brief
                }
              } catch (e) {
                console.error('Failed to get git repo brief:', e)
              }
            })
          ).then(() => {
            this.treeData = [...this.treeData]
          })
        }

        resolve()
      })
    },

    onNodeContextMenu(e: MouseEvent, path: string, isDirectory: boolean) {
      e.preventDefault()
      e.stopPropagation()

      if (!path) return

      this.contextMenu = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        path,
        isDirectory
      }

      // 调整菜单位置确保不超出屏幕
      this.$nextTick(() => {
        const menu = document.querySelector('.directory-tree .context-menu') as HTMLElement
        if (menu) {
          const rect = menu.getBoundingClientRect()
          if (rect.right > window.innerWidth) {
            this.contextMenu.x = window.innerWidth - rect.width - 10
          }
          if (rect.bottom > window.innerHeight) {
            this.contextMenu.y = window.innerHeight - rect.height - 10
          }
        }
      })
    },

    closeContextMenu() {
      this.contextMenu.visible = false
    },

    onNodeDoubleClick(e: MouseEvent, path: string, isDirectory: boolean) {
      // 只有文件才支持双击打开，目录忽略
      if (isDirectory) return
      if (!path) return

      // 调用编辑文件的方法
      this.handleEditFileByPath(path)
    },

    async handleOpenTerminal() {
      const dirPath = this.contextMenu.path
      // 用 rootPath 查找项目信息
      const project = appBusiness.projects.find(p => this.rootPath.startsWith(p.path) || this.rootPath === p.path)
      if (!project) {
        alert('找不到所属项目，无法创建终端')
        this.closeContextMenu()
        return
      }
      // 用项目信息创建 tab，但用右键的路径创建终端，tab名称用目录名
      const dirName = dirPath.split('/').pop() || dirPath
      await appBusiness.launchTerminal(project.id, dirName, dirPath)
      this.closeContextMenu()
    },

    async handleOpenInEditor() {
      try {
        await apiOpenProjectInEditor(this.contextMenu.path)
      } catch (e) {
        alert(`打开编辑器失败: ${e}`)
      }
      this.closeContextMenu()
    },

    handleSearchInDirectory() {
      this.$emit('search-in-directory', this.contextMenu.path)
      this.closeContextMenu()
    },

    async handleEditFileByPath(filePath: string) {
      if (!filePath) {
        return
      }
      try {
        // 根据 rootPath 查找对应的项目
        const project = appBusiness.projects.find(p => this.rootPath.startsWith(p.path) || this.rootPath === p.path)
        if (!project) {
          alert('找不到所属项目，无法编辑文件')
          return
        }
        const content = await apiReadFile(filePath)
        this.$emit('open-editor', {
          projectId: project.id,
          projectName: project.name,
          path: filePath,
          content
        })
      } catch (e) {
        alert(`读取文件失败: ${e}`)
      }
    },

    async handleEditFile() {
      const filePath = this.contextMenu.path
      if (!filePath) {
        alert('文件路径无效')
        return
      }
      try {
        // 根据 rootPath 查找对应的项目
        const project = appBusiness.projects.find(p => this.rootPath.startsWith(p.path) || this.rootPath === p.path)
        if (!project) {
          alert('找不到所属项目，无法编辑文件')
          this.closeContextMenu()
          return
        }
        const content = await apiReadFile(filePath)
        this.$emit('open-editor', {
          projectId: project.id,
          projectName: project.name,
          path: filePath,
          content
        })
      } catch (e) {
        alert(`读取文件失败: ${e}`)
      }
      this.closeContextMenu()
    },

    handleDelete() {
      this.pathToDelete = this.contextMenu.path
      this.showConfirm = true
      this.closeContextMenu()
    },

    removeNodeByPath(tree: TreeNode[], path: string): boolean {
      for (let i = 0; i < tree.length; i++) {
        if (tree[i].path === path) {
          tree.splice(i, 1)
          return true
        }
        if (tree[i].children) {
          const removed = this.removeNodeByPath(tree[i].children!, path)
          if (removed) return true
        }
      }
      return false
    },

    async confirmDelete() {
      try {
        await apiDeletePath(this.pathToDelete)
        this.removeNodeByPath(this.treeData, this.pathToDelete)
        this.treeData = [...this.treeData]
        // 如果被删除的节点当前处于选中状态，移除选中
        if (this.selectedKeys.includes(this.pathToDelete)) {
          this.selectedKeys = this.selectedKeys.filter(k => k !== this.pathToDelete)
        }
      } catch (e) {
        alert(`删除失败: ${e}`)
      }
      this.showConfirm = false
    },

    handleCopyPath() {
      try {
        navigator.clipboard.writeText(this.contextMenu.path)
      } catch (e) {
        alert(`复制失败: ${e}`)
      }
      this.closeContextMenu()
    },

    handleRefresh() {
      this.$emit('refresh', this.contextMenu.path)
      this.closeContextMenu()
    },

    async handleOpenCommitDialog() {
      const dirPath = this.contextMenu.path
      this.closeContextMenu()

      this.commitDialog.loading = true
      this.commitDialog.visible = true
      this.commitDialog.dirPath = dirPath
      this.commitDialog.repoPath = ''
      this.commitDialog.files = []
      this.commitDialog.branch = ''
      this.commitDialog.remote = ''
      this.commitDialog.ahead = 0
      this.commitDialog.behind = 0
      this.commitDialog.lastCommit = null
      this.commitDialog.tooManyFilesCount = 0

      try {
        const brief = await getGitRepoBrief(dirPath)
        if (!brief.isRepo) {
          alert('该目录不是 Git 仓库')
          this.commitDialog.visible = false
          return
        }
        const repoPath = brief.rootPath || dirPath
        this.commitDialog.repoPath = repoPath

        // 文件数量过多，跳过 status 接口，直接显示警告
        if ((brief.changesCount || 0) > 2000) {
          this.commitDialog.tooManyFilesCount = brief.changesCount
          this.commitDialog.loading = false
          return
        }

        const [status, remoteInfo, lastCommit] = await Promise.all([
          apiGetGitStatus(dirPath),
          getGitRemote(dirPath),
          getGitLastCommit(dirPath)
        ])

        this.commitDialog.branch = status.branch || ''
        this.commitDialog.ahead = status.ahead || 0
        this.commitDialog.behind = status.behind || 0
        this.commitDialog.remote = remoteInfo?.remoteUrl || remoteInfo?.remote || ''
        this.commitDialog.lastCommit = lastCommit?.hash ? lastCommit : null

        const files = this.buildCommitFiles(status, dirPath, repoPath)
        this.commitDialog.files = files
      } catch (e) {
        alert(`加载 Git 状态失败: ${e}`)
        this.commitDialog.visible = false
      } finally {
        this.commitDialog.loading = false
      }
    },

    buildCommitFiles(status: any, dirPath: string, repoPath: string): CommitFile[] {
      const files: CommitFile[] = []
      const dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/'
      const MAX_FILES = 500

      const addIfUnderDir = (file: string, badge: string) => {
        if (files.length >= MAX_FILES) return
        const absPath = repoPath.endsWith('/') ? repoPath + file : repoPath + '/' + file
        if (absPath.startsWith(dirPrefix) || absPath === dirPath) {
          files.push({ path: file, name: file, badge })
        }
      }

      status.modified?.forEach((f: string) => addIfUnderDir(f, 'M'))
      status.untracked?.forEach((f: string) => addIfUnderDir(f, 'U'))
      status.deleted?.forEach((f: string) => addIfUnderDir(f, 'D'))
      status.created?.forEach((f: string) => addIfUnderDir(f, 'A'))
      status.renamed?.forEach((f: string) => addIfUnderDir(f, 'R'))
      status.conflicted?.forEach((f: string) => addIfUnderDir(f, 'C'))
      status.staged?.forEach((f: string) => {
        let badge = 'M'
        if (status.deleted?.includes(f)) badge = 'D'
        else if (status.created?.includes(f)) badge = 'A'
        else if (status.renamed?.includes(f)) badge = 'R'
        else if (status.conflicted?.includes(f)) badge = 'C'
        addIfUnderDir(f, badge)
      })

      const seen = new Set<string>()
      return files.filter(f => {
        if (seen.has(f.path)) return false
        seen.add(f.path)
        return true
      })
    },

    async handleCommitFiles({ files, message }: { files: string[]; message: string }) {
      if (!this.commitDialog.repoPath || files.length === 0) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitCommit(this.commitDialog.repoPath, message, files)
        if (result.success) {
          alert('提交成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '提交失败')
        }
      } catch (e) {
        alert(`提交失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async handleDialogPull() {
      if (!this.commitDialog.repoPath) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitPull(this.commitDialog.repoPath)
        if (result.success) {
          alert('拉取成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '拉取失败')
        }
      } catch (e) {
        alert(`拉取失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async handleDialogPush() {
      if (!this.commitDialog.repoPath) return
      this.commitDialog.committing = true
      try {
        const result = await apiGitPush(this.commitDialog.repoPath)
        if (result.success) {
          alert('推送成功')
          await this.refreshCommitDialog()
        } else {
          alert(result.message || '推送失败')
        }
      } catch (e) {
        alert(`推送失败: ${e}`)
      } finally {
        this.commitDialog.committing = false
      }
    },

    async refreshCommitDialog() {
      try {
        this.commitDialog.loading = true
        const repoPath = this.commitDialog.repoPath
        const dirPath = this.commitDialog.dirPath

        // 先获取 brief，判断文件数量是否仍然过多
        const brief = await getGitRepoBrief(dirPath)
        if (brief.isRepo && (brief.changesCount || 0) > 2000) {
          this.commitDialog.tooManyFilesCount = brief.changesCount
          this.commitDialog.files = []
          this.commitDialog.loading = false
          // 更新目录树 git 角标
          const node = this.findTreeNodeByPath(this.treeData, dirPath)
          if (node && node.hasGitDir) {
            node.gitRepo = brief
            this.treeData = [...this.treeData]
          }
          return
        }

        const [status, remoteInfo, lastCommit] = await Promise.all([
          apiGetGitStatus(repoPath),
          getGitRemote(repoPath),
          getGitLastCommit(repoPath)
        ])

        this.commitDialog.tooManyFilesCount = 0
        this.commitDialog.branch = status.branch
        this.commitDialog.ahead = status.ahead
        this.commitDialog.behind = status.behind
        this.commitDialog.remote = remoteInfo.remoteUrl || remoteInfo.remote
        this.commitDialog.lastCommit = lastCommit.hash ? lastCommit : null

        const files = this.buildCommitFiles(status, dirPath, repoPath)
        this.commitDialog.files = files

        // 更新目录树 git 角标
        const node = this.findTreeNodeByPath(this.treeData, dirPath)
        if (node && node.hasGitDir) {
          if (brief.isRepo) {
            node.gitRepo = brief
            this.treeData = [...this.treeData]
          }
        }
      } catch (e) {
        console.error('刷新弹窗失败:', e)
      } finally {
        this.commitDialog.loading = false
      }
    }
  }
})
</script>

<style scoped>
.directory-tree {
  font-size: 12px;
  color: #d4d4d4;
  user-select: none;
  padding: 4px 0;
}

.tree-loading {
  padding: 8px 12px;
}

.tree-node-title {
  display: inline-block;
  width: 100%;
}

.tree-node-title.git-ignored {
  opacity: 0.5;
}

.tree-git-icon-wrapper {
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  vertical-align: middle;
  flex-shrink: 0;
}

.tree-git-icon {
  color: #858585;
}

.tree-git-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  margin-left: 2px;
  background: #5a8c5a;
  color: #fff;
  border-radius: 7px;
  font-size: 9px;
  font-weight: bold;
  flex-shrink: 0;
}

.tree-git-ahead {
  color: #2e7d32;
  font-size: 9px;
  font-weight: bold;
  margin-left: 2px;
}

.tree-git-behind {
  color: #c42b1c;
  font-size: 9px;
  font-weight: bold;
  margin-left: 1px;
}

/* 自定义 tree 样式 */
:deep(.ant-tree) {
  background: transparent;
  color: #d4d4d4;
  font-size: 12px;
}

:deep(.ant-tree-treenode) {
  padding: 2px 0;
  cursor: pointer;
}

:deep(.ant-tree-treenode:hover .ant-tree-node-content-wrapper) {
  background: #3c3c3c;
}

:deep(.ant-tree-node-content-wrapper) {
  color: #d4d4d4;
  padding: 0 4px;
  border-radius: 3px;
  height: 22px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  cursor: pointer;
}

:deep(.ant-tree-node-selected) {
  background: #094771 !important;
}

:deep(.ant-tree-switcher) {
  color: #858585;
  width: 22px;
  flex-shrink: 0;
}

:deep(.ant-tree-iconEle) {
  display: none !important;
}

:deep(.ant-tree-switcher) {
  background: transparent;
}

:deep(.ant-tree-indent-unit) {
  width: 22px;
}

:deep(.ant-tree-iconContainer) {
  display: none !important;
}

/* 隐藏所有叶子节点图标 */
:deep(.ant-tree-leaf-icon) {
  display: none !important;
}

:deep(.ant-tree-leaf-icon-el) {
  display: none !important;
}

.context-menu {
  position: fixed;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 99999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.context-menu-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #333333;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #e8f0fe;
}

.context-menu-item.danger:hover {
  background: #fce8e6;
  color: #c42b1c;
}

.context-menu-separator {
  height: 1px;
  background: #e0e0e0;
  margin: 4px 0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
}

.modal {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
}

.confirm-modal {
  width: 350px;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #333333;
}

.modal-close {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 20px;
  cursor: pointer;
}

.modal-close:hover {
  color: #333333;
}

.modal-body {
  padding: 16px;
  color: #333333;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-confirm {
  padding: 6px 12px;
  background: #007acc;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.btn-confirm.danger {
  background: #c42b1c;
}

.btn-confirm:hover {
  opacity: 0.9;
}
</style>
