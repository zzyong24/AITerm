<template>
  <div class="modal-overlay" @click="$emit('cancel')">
    <div class="modal commit-modal" @click.stop>
      <div class="modal-header">
        <div class="header-info">
          <span class="header-title">版本管理</span>
          <div class="header-badges" v-if="branch">
            <span class="branch-badge">{{ branch }}</span>
            <span v-if="ahead > 0 || behind > 0" class="sync-badge"
              :class="{ 'has-ahead': ahead > 0, 'has-behind': behind > 0 }">
              {{ ahead > 0 ? '↑' + ahead : '' }}{{ behind > 0 ? '↓' + behind : '' }}
            </span>
            <span v-if="remote" class="remote-badge" :title="remote">{{ remote }}</span>
          </div>
          <div v-if="lastCommit" class="last-commit-info">
            <span class="commit-hash">{{ lastCommit.hash.substring(0, 7) }}</span>
            <span class="commit-message">{{ lastCommit.message }}</span>
            <span class="commit-date">{{ formatDate(lastCommit.date) }}</span>
          </div>
        </div>
        <button class="modal-close-btn" @click="$emit('cancel')" title="关闭">×</button>
      </div>
      <div class="modal-body">
        <div v-if="loading" class="commit-loading">加载中...</div>
        <div v-else-if="fileList.length === 0 && !hasManyFiles" class="commit-empty">没有可提交的文件</div>
        <div v-else>
          <div v-if="hasManyFiles" class="commit-warning">
            <strong>文件数量过多（{{ actualFileCount }} 项）</strong>，弹窗无法完整展示与处理。<br />
            建议在终端中使用 <code>git add . && git commit -m "msg"</code> 提交全部变更，
            或补充 <code>.gitignore</code> 后重新打开。
          </div>
          <div v-else class="commit-file-list">
            <label class="commit-file-item commit-select-all">
              <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
              <span>全选</span>
            </label>
            <label v-for="file in displayFiles" :key="file.path" class="commit-file-item">
              <input v-model="selectedFiles" type="checkbox" :value="file.path" />
              <span class="commit-badge" :class="'badge-' + file.badge">{{ file.badge }}</span>
              <span class="commit-file-name">{{ file.name }}</span>
            </label>
            <div v-if="fileList.length > displayLimit" class="commit-overflow">
              仅显示前 {{ displayLimit }} 项，共 {{ fileList.length }} 项文件。
            </div>
          </div>
        </div>
        <div v-if="fileList.length > 0 && !hasManyFiles" class="commit-legend">
          <span class="legend-item"><span class="commit-badge badge-M">M</span> 已修改</span>
          <span class="legend-item"><span class="commit-badge badge-U">U</span> 未跟踪</span>
          <span class="legend-item"><span class="commit-badge badge-A">A</span> 已添加</span>
          <span class="legend-item"><span class="commit-badge badge-D">D</span> 已删除</span>
          <span class="legend-item"><span class="commit-badge badge-R">R</span> 已重命名</span>
          <span class="legend-item"><span class="commit-badge badge-C">C</span> 冲突</span>
        </div>
        <div v-if="fileList.length > 0 && !hasManyFiles" class="commit-quick-select">
          <span class="quick-select-label">快捷选择:</span>
          <button class="quick-select-btn" @click="selectByBadge('M')">M</button>
          <button class="quick-select-btn" @click="selectByBadge('U')">U</button>
          <button class="quick-select-btn" @click="selectByBadge('A')">A</button>
          <button class="quick-select-btn" @click="selectByBadge('D')">D</button>
          <button class="quick-select-btn" @click="selectByBadge('R')">R</button>
          <button class="quick-select-btn" @click="selectByBadge('C')">C</button>
        </div>
        <input v-if="fileList.length > 0 && !hasManyFiles" v-model="commitMessage" type="text"
          class="commit-message-input" placeholder="输入提交信息..." />
      </div>
      <div class="modal-footer">
        <div class="footer-left">
          <button class="btn-action" @click="$emit('pull')" :disabled="!remote || behind === 0 || committing"
            :class="{ loading: committing }" title="从远程拉取">
            <span v-if="committing" class="btn-spinner" />
            <span>拉取</span>
          </button>
          <button class="btn-action" @click="$emit('push')" :disabled="!remote || ahead === 0 || committing"
            :class="{ loading: committing }" title="推送到远程">
            <span v-if="committing" class="btn-spinner" />
            <span>推送</span>
          </button>
          <button class="btn-action btn-commit-all" @click="handleCommitAll"
            :disabled="!canCommitAll || committing" :class="{ loading: committing }"
            title="git add . && git commit -m">
            <span v-if="committing" class="btn-spinner" />
            <span>全部提交</span>
          </button>
        </div>
        <div class="footer-right">
          <button class="btn-cancel" @click="$emit('cancel')" :disabled="committing">取消</button>
          <button class="btn-confirm" :disabled="!canCommit || committing" :class="{ loading: committing }"
            @click="handleCommit">
            <span v-if="committing" class="btn-spinner" />
            <span>提交</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export interface CommitFile {
  path: string
  name: string
  badge: string
}

export default defineComponent({
  name: 'GitCommitDialog',

  props: {
    fileList: {
      type: Array as () => CommitFile[],
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    committing: {
      type: Boolean,
      default: false
    },
    branch: {
      type: String,
      default: ''
    },
    remote: {
      type: String,
      default: ''
    },
    ahead: {
      type: Number,
      default: 0
    },
    behind: {
      type: Number,
      default: 0
    },
    lastCommit: {
      type: Object as () => { hash: string; date: string; message: string } | null,
      default: null
    },
    tooManyFilesCount: {
      type: Number,
      default: 0
    }
  },

  emits: ['commit', 'cancel', 'pull', 'push'],

  data() {
    return {
      selectedFiles: [] as string[],
      commitMessage: '',
      displayLimit: 500
    }
  },

  computed: {
    canCommit(): boolean {
      return this.selectedFiles.length > 0 && this.commitMessage.trim().length > 0
    },
    isAllSelected(): boolean {
      return this.fileList.length > 0 && this.selectedFiles.length === this.fileList.length
    },
    selectedCount(): number {
      return this.fileList.length > this.displayLimit ? this.selectedFiles.length : this.displayFiles.length
    },
    totalCount(): number {
      return this.fileList.length
    },
    hasManyFiles(): boolean {
      return this.fileList.length > 2000 || this.tooManyFilesCount > 2000
    },
    actualFileCount(): number {
      return this.tooManyFilesCount > 0 ? this.tooManyFilesCount : this.fileList.length
    },
    displayFiles(): CommitFile[] {
      return this.fileList.slice(0, this.displayLimit)
    }
  },

  mounted() {
    this.selectedFiles = this.fileList.map(f => f.path)
  },

  watch: {
    fileList() {
      this.selectedFiles = this.fileList.map(f => f.path)
      this.commitMessage = ''
    }
  },

  methods: {
    toggleSelectAll() {
      if (this.selectedFiles.length === this.fileList.length) {
        this.selectedFiles = []
      } else {
        this.selectedFiles = this.fileList.map(f => f.path)
      }
    },

    selectByBadge(badge: string) {
      const badgeFiles = this.fileList.filter(f => f.badge === badge).map(f => f.path)
      const allSelected = badgeFiles.every(p => this.selectedFiles.includes(p))
      if (allSelected) {
        this.selectedFiles = this.selectedFiles.filter(p => !badgeFiles.includes(p))
      } else {
        const merged = [...this.selectedFiles, ...badgeFiles]
        this.selectedFiles = [...new Set(merged)]
      }
    },

    handleCommit() {
      this.$emit('commit', {
        files: this.selectedFiles,
        message: this.commitMessage.trim()
      })
    },

    formatDate(dateStr: string): string {
      if (!dateStr) return ''
      try {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return '刚刚'
        if (diffMins < 60) return `${diffMins} 分钟前`
        if (diffHours < 24) return `${diffHours} 小时前`
        if (diffDays < 7) return `${diffDays} 天前`
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
      } catch {
        return dateStr
      }
    }
  }
})
</script>

<style scoped>
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
  z-index: 99999;
}

.modal {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  overflow: hidden;
}

.commit-modal {
  width: 520px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: #858585;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
  margin-left: 12px;
}

.modal-close-btn:hover {
  color: #333333;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: #333333;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.branch-badge {
  padding: 2px 8px;
  background: #4caf50;
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.sync-badge {
  padding: 2px 6px;
  background: #f0f0f0;
  color: #666666;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.sync-badge.has-ahead {
  color: #2e7d32;
}

.sync-badge.has-behind {
  color: #c42b1c;
}

.remote-badge {
  padding: 2px 6px;
  background: #f0f0f0;
  color: #007acc;
  border-radius: 4px;
  font-size: 10px;
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-break: break-all;
}

.last-commit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 11px;
  color: #666666;
}

.commit-hash {
  padding: 1px 4px;
  background: #f0f0f0;
  border-radius: 3px;
  color: #2e7d32;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 10px;
}

.commit-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #333333;
}

.commit-date {
  flex-shrink: 0;
  color: #666666;
}

.modal-body {
  padding: 16px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.commit-loading,
.commit-empty {
  color: #666666;
  font-size: 13px;
  text-align: center;
  padding: 12px 0;
}

.commit-warning {
  padding: 10px 12px;
  background: #fce8e6;
  border: 1px solid #c42b1c;
  border-radius: 4px;
  color: #c42b1c;
  font-size: 12px;
  line-height: 1.6;
}

.commit-warning code {
  background: #f0f0f0;
  padding: 1px 4px;
  border-radius: 3px;
  color: #333333;
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 11px;
}

.commit-file-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.commit-overflow {
  padding: 6px 0;
  font-size: 11px;
  color: #c42b1c;
  text-align: center;
}

.commit-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  color: #333333;
  font-size: 12px;
}

.commit-file-item:hover {
  opacity: 0.9;
}

.commit-file-item input {
  cursor: pointer;
}

.commit-select-all {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 6px !important;
  margin-bottom: 4px;
  font-weight: 500;
}

.commit-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  flex-shrink: 0;
  color: #fff;
}

.commit-badge.badge-M {
  background: #f48771;
}

.commit-badge.badge-D {
  background: #c42b1c;
}

.commit-badge.badge-A {
  background: #4ec9b0;
}

.commit-badge.badge-U {
  background: #8b6914;
}

.commit-badge.badge-R {
  background: #007acc;
}

.commit-badge.badge-C {
  background: #b180d7;
}

.commit-file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commit-message-input {
  width: 100%;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  font-size: 13px;
  outline: none;
}

.commit-message-input:focus {
  border-color: #007acc;
}

.commit-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #666666;
}

.commit-quick-select {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-select-label {
  font-size: 11px;
  color: #666666;
  margin-right: 2px;
}

.quick-select-btn {
  padding: 2px 6px;
  background: #f0f0f0;
  border: 1px solid #d4d4d4;
  border-radius: 3px;
  color: #333333;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-select-btn:hover {
  background: #e0e0e0;
  border-color: #007acc;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.btn-cancel,
.btn-confirm,
.btn-action {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #d4d4d4;
  color: #333333;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.btn-confirm {
  background: #007acc;
  border: none;
  color: #fff;
}

.btn-confirm:hover:not(:disabled) {
  background: #005a9e;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action {
  background: #f0f0f0;
  border: 1px solid #d4d4d4;
  color: #333333;
}

.btn-action:hover:not(:disabled) {
  background: #e0e0e0;
  border-color: #007acc;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-confirm,
.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-confirm.loading,
.btn-action.loading {
  position: relative;
}

.btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
