<template>
  <div class="directory-tree" @contextmenu.prevent="onContextMenu">
    <a-spin v-if="loading && !treeData.length" size="small" class="tree-loading" />
    <a-tree
      v-if="treeData.length"
      :tree-data="treeData"
      :selected-keys="selectedKeys"
      :expanded-keys="expandedKeys"
      :auto-expand-parent="autoExpandParent"
      :show-line="{ showLeafIcon: false }"
      :load-data="onLoadData"
      :selected="selectedKeys.length > 0"
      @select="onSelect"
      @expand="onExpand"
    >
      <template #title="{ dataRef }">
        <span class="tree-node-title" :data-path="dataRef.path" @contextmenu="(e) => onNodeContextMenu(e, dataRef.path)">{{ dataRef.title }}</span>
      </template>
    </a-tree>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="handleOpenTerminal">打开到终端</div>
      <div class="context-menu-separator" />
      <div class="context-menu-item" @click="handleEditFile">编辑</div>
      <div class="context-menu-item" @click="handleOpenInEditor">在编辑器中打开</div>
      <div class="context-menu-separator" />
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
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { Tree } from 'ant-design-vue'
import {
  isDirectory as apiIsDirectory,
  readDirectory as apiReadDirectory,
  readFile as apiReadFile,
  openProjectInEditor as apiOpenProjectInEditor,
  deletePath as apiDeletePath
} from '../api'
import { appBusiness } from '../store/AppBusiness'
import { alert } from '../plugins/MessageBox'

interface TreeNode {
  title: string
  key: string
  path: string
  isDirectory: boolean
  children?: TreeNode[]
  loading?: boolean
}

export default defineComponent({
  name: 'DirectoryTree',

  components: {
    'a-tree': Tree
  },

  props: {
    rootPath: {
      type: String,
      required: true
    }
  },

  emits: ['node-click', 'open-editor', 'open-terminal'],

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
        path: ''
      },
      showConfirm: false,
      pathToDelete: ''
    }
  },

  mounted() {
    this.loadTree()

    window.addEventListener('click', this.closeContextMenu)
  },

  beforeUnmount() {
    window.removeEventListener('click', this.closeContextMenu)
  },

  methods: {
    async loadTree() {
      this.loading = true
      try {
        const isDir = await apiIsDirectory(this.rootPath)
        if (isDir) {
          const children = await this.readDirectory(this.rootPath)
          // 直接设置 children 为 treeData，不要根节点
          this.treeData = children
          // 默认全部折叠
          this.expandedKeys = []
        }
      } catch (e) {
        console.error('Failed to load tree:', e)
      } finally {
        this.loading = false
      }
    },

    async readDirectory(dirPath: string): Promise<TreeNode[]> {
      try {
        const entries = await apiReadDirectory(dirPath, true)
        const nodes: TreeNode[] = []

        for (const entry of entries) {
          const fullPath = dirPath.endsWith('/') ? `${dirPath}${entry}` : `${dirPath}/${entry}`
          const isDir = await apiIsDirectory(fullPath)

          nodes.push({
            title: entry,
            key: fullPath,
            path: fullPath,
            isDirectory: isDir,
            children: isDir ? [] : undefined,
            isLeaf: !isDir
          })
        }

        // 排序：目录在前，文件在后
        return nodes.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.title.localeCompare(b.title)
        })
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

        resolve()
      })
    },

    onNodeContextMenu(e: MouseEvent, path: string) {
      e.preventDefault()
      e.stopPropagation()

      if (!path) return

      this.contextMenu = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        path
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

    async confirmDelete() {
      try {
        await apiDeletePath(this.pathToDelete)
        await this.loadTree()
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
  width: 16px;
  flex-shrink: 0;
}

:deep(.ant-tree-iconEle) {
  display: none !important;
}

:deep(.ant-tree-switcher) {
  background: transparent;
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
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  z-index: 99999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.context-menu-item {
  padding: 6px 12px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 13px;
}

.context-menu-item:hover {
  background: #094771;
}

.context-menu-item.danger:hover {
  background: #5a1d1d;
  color: #f48771;
}

.context-menu-separator {
  height: 1px;
  background: #3e3e42;
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
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
}

.confirm-modal {
  width: 350px;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.modal-close {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 20px;
  cursor: pointer;
}

.modal-close:hover {
  color: #d4d4d4;
}

.modal-body {
  padding: 16px;
  color: #d4d4d4;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel {
  padding: 6px 12px;
  background: #3e3e42;
  border: none;
  border-radius: 4px;
  color: #d4d4d4;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #4e4e4e;
}

.btn-confirm {
  padding: 6px 12px;
  background: #0e639c;
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
