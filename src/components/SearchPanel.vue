<template>
  <div class="search-panel">
    <div class="search-header">
      <span class="search-title">搜索</span>
    </div>
    <div class="search-input-container">
      <div class="search-row">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索文件内容..." ref="searchInputRef"
          @keydown.enter="handleSearch" @keydown.up.prevent="navigateHistory(-1)"
          @keydown.down.prevent="navigateHistory(1)" @keydown.escape="hideHistoryDropdown"
          @focus="showHistoryDropdown = true" @input="handleSearchInput" />
      </div>
      <!-- 历史搜索下拉 -->
      <div v-if="showHistoryDropdown && searchHistory.length > 0" class="search-history-dropdown">
        <div v-for="(item, idx) in filteredHistory" :key="idx" class="search-history-item"
          :class="{ selected: idx === selectedHistoryIndex }" @click="selectHistoryItem(item)">
          {{ item }}
        </div>
      </div>
      <div class="search-row">
        <input v-model="searchExtensions" type="text" class="search-extensions-input"
          placeholder="扩展名: *.ts,*.js,*.vue 或留空搜索全部" />
      </div>
      <div class="search-row">
        <span class="search-label">目录:</span>
        <span class="search-path">{{ searchPath || '全部项目' }}</span>
        <button class="btn-small" @click="showPathPicker = !showPathPicker">选择</button>
        <div v-if="showPathPicker" class="path-picker">
          <div class="path-picker-item" @click="selectSearchPath('')">全部项目</div>
          <div v-for="project in projects" :key="project.id" class="path-picker-item"
            @click="selectSearchPath(project.path)">
            {{ project.name }}
          </div>
        </div>
      </div>
      <div class="search-options">
        <label class="search-option">
          <input type="checkbox" v-model="searchOptions.caseSensitive" />
          区分大小写
        </label>
        <label class="search-option">
          <input type="checkbox" v-model="searchOptions.wholeWord" />
          全字匹配
        </label>
        <label class="search-option">
          <input type="checkbox" v-model="searchOptions.regex" />
          正则
        </label>
      </div>
    </div>
    <div class="search-results">
      <div v-if="searching" class="search-empty">
        搜索中...
      </div>
      <div v-else-if="searchQuery && searchResults.length === 0" class="search-empty">
        未找到匹配结果
      </div>
      <div v-if="hasMoreSearchResults" class="search-warning">
        结果过多，仅显示前 50 个文件。请使用更具体的搜索词缩小范围。
      </div>
      <div v-for="{ file, results } in limitedGroupedResults" :key="file" class="search-file-group">
        <div class="search-file-header" @click="toggleFileExpand(file)">
          <span class="expand-icon">{{ expandedFiles.includes(file) ? '▼' : '▶' }}</span>
          <span class="search-result-file">{{ file }}</span>
          <span class="search-result-count">{{ results.length }} 个匹配</span>
        </div>
        <div v-if="expandedFiles.includes(file)" class="search-file-matches">
          <div v-for="(result, idx) in results" :key="idx" class="search-match-item"
            @click="handleSearchResultClick(result)">
            <span class="match-line">{{ result.line }}</span>
            <span class="match-preview">{{ getMatchPreview(result) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents, type Project } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import { searchFileContent as apiSearchFileContent, readFile as apiReadFile } from '../api'

interface SearchResultItem {
  file: string
  path: string
  line: number
  preview?: string
}

export default defineComponent({
  name: 'SearchPanel',
  emits: ['open-editor'],
  data() {
    return {
      projects: [] as Project[],
      searchQuery: '',
      searchResults: [] as SearchResultItem[],
      searchPath: '',
      searchExtensions: '',
      showPathPicker: false,
      searching: false,
      expandedFiles: [] as string[],
      searchOptions: {
        caseSensitive: false,
        wholeWord: false,
        regex: false
      },
      searchHistory: [] as string[],
      selectedHistoryIndex: -1,
      showHistoryDropdown: false
    }
  },
  computed: {
    filteredHistory(): string[] {
      if (!this.searchQuery) {
        return this.searchHistory.slice(0, 10)
      }
      const query = this.searchQuery.toLowerCase()
      return this.searchHistory.filter(h => h.toLowerCase().includes(query)).slice(0, 5)
    },
    groupedResults(): Record<string, SearchResultItem[]> {
      const grouped: Record<string, SearchResultItem[]> = {}
      for (const result of this.searchResults) {
        if (!grouped[result.file]) {
          grouped[result.file] = []
        }
        if (grouped[result.file].length < 10) {
          grouped[result.file].push(result)
        }
      }
      return grouped
    },
    limitedGroupedResults(): { file: string; results: SearchResultItem[] }[] {
      const entries = Object.entries(this.groupedResults)
      const maxFiles = 50
      if (entries.length <= maxFiles) {
        return entries.map(([file, results]) => ({ file, results }))
      }
      return entries.slice(0, maxFiles).map(([file, results]) => ({ file, results }))
    },
    hasMoreSearchResults(): boolean {
      return Object.keys(this.groupedResults).length > 50
    }
  },
  mounted() {
    eventBus.on(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.on(AppEvents.INITIALIZED, this.handleInitialized)
    this.projects = [...appBusiness.projects]
    this.loadSearchHistory()
  },
  beforeUnmount() {
    eventBus.off(AppEvents.PROJECTS_CHANGE, this.handleProjectsChange)
    eventBus.off(AppEvents.INITIALIZED, this.handleInitialized)
  },
  methods: {
    handleProjectsChange(projects: Project[]) {
      this.projects = [...projects]
    },
    handleInitialized(data: { projects: Project[] }) {
      this.projects = [...data.projects]
    },
    handleSearchInput() {
      this.selectedHistoryIndex = -1
      this.showHistoryDropdown = true
    },
    hideHistoryDropdown() {
      this.showHistoryDropdown = false
      this.selectedHistoryIndex = -1
    },
    navigateHistory(direction: number) {
      const filtered = this.filteredHistory
      if (filtered.length === 0) return

      if (this.selectedHistoryIndex === -1) {
        this.selectedHistoryIndex = direction > 0 ? 0 : filtered.length - 1
      } else {
        this.selectedHistoryIndex += direction
        if (this.selectedHistoryIndex < 0) this.selectedHistoryIndex = filtered.length - 1
        if (this.selectedHistoryIndex >= filtered.length) this.selectedHistoryIndex = 0
      }
      this.searchQuery = filtered[this.selectedHistoryIndex]
    },
    selectHistoryItem(item: string) {
      this.searchQuery = item
      this.selectedHistoryIndex = -1
      this.showHistoryDropdown = false
      this.handleSearch()
    },
    loadSearchHistory() {
      try {
        const saved = localStorage.getItem('searchHistory')
        if (saved) {
          this.searchHistory = JSON.parse(saved)
        }
      } catch (e) {
        console.error('Failed to load search history:', e)
      }
    },
    saveSearchHistory() {
      try {
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory))
      } catch (e) {
        console.error('Failed to save search history:', e)
      }
    },
    handleSearch() {
      const query = this.searchQuery.trim()
      if (!query) {
        this.searchResults = []
        return
      }

      if (!this.searchHistory.includes(query)) {
        this.searchHistory.unshift(query)
        if (this.searchHistory.length > 10) {
          this.searchHistory.pop()
        }
        this.saveSearchHistory()
      }

      let searchPath = this.searchPath
      if (!searchPath && appBusiness.activeProjectId) {
        const project = this.projects.find(p => p.id === appBusiness.activeProjectId)
        if (project) {
          searchPath = project.path
        }
      }

      if (!searchPath) {
        this.searchResults = []
        return
      }

      const extensions = this.searchExtensions.trim() || '*.*'

      this.searching = true
      this.expandedFiles = []

      apiSearchFileContent(searchPath, query, 200, extensions)
        .then(results => {
          this.searchResults = results.map(r => ({ ...r }))
          this.searching = false
          const files = Object.keys(this.groupedResults).slice(0, 5)
          this.expandedFiles = files
        })
        .catch(e => {
          console.error('Search failed:', e)
          this.searchResults = []
          this.searching = false
        })
    },
    handleSearchResultClick(result: { file: string; path: string; line: number }) {
      const project = this.projects.find(p => result.path.startsWith(p.path))
      if (project) {
        const projectId = project.id
        const projectName = project.name
        apiReadFile(result.path).then(content => {
          this.$emit('open-editor', {
            projectId,
            projectName,
            path: result.path,
            content,
            line: result.line
          })
        })
      }
    },
    getMatchPreview(result: { file: string; path: string; line: number; preview?: string }): string {
      if (!result.preview) {
        return `第 ${result.line} 行`
      }

      let preview = result.preview.trim()
      const query = this.searchQuery.trim()
      const lines = preview.split('\n')
      if (lines.length > 1) {
        const middleIndex = Math.floor(lines.length / 2)
        preview = lines[middleIndex].trim()
      }

      if (preview.length <= 30) {
        return preview
      }

      if (query) {
        const lowerPreview = preview.toLowerCase()
        const lowerQuery = query.toLowerCase()
        const queryIndex = lowerPreview.indexOf(lowerQuery)

        if (queryIndex !== -1) {
          const contextLength = 10
          let start = Math.max(0, queryIndex - contextLength)
          let end = Math.min(preview.length, queryIndex + query.length + contextLength)

          let cropped = ''
          if (start > 0) cropped += '...'
          cropped += preview.substring(start, end)
          if (end < preview.length) cropped += '...'
          return cropped
        }
      }

      return preview.substring(0, 30) + '...'
    },
    selectSearchPath(path: string) {
      this.searchPath = path
      this.showPathPicker = false
    },
    toggleFileExpand(file: string) {
      const idx = this.expandedFiles.indexOf(file)
      if (idx >= 0) {
        this.expandedFiles.splice(idx, 1)
      } else {
        this.expandedFiles.push(file)
      }
    }
  }
})
</script>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #252526;
}

.search-header {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #858585;
  border-bottom: 1px solid #3e3e42;
}

.search-title {
  color: #d4d4d4;
}

.search-input-container {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-row:last-child {
  margin-bottom: 0;
}

.search-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: #007acc;
}

.search-extensions-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
}

.search-extensions-input:focus {
  border-color: #007acc;
}

.search-label {
  font-size: 12px;
  color: #858585;
}

.search-path {
  font-size: 11px;
  color: #6a6a6a;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-small {
  background: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.btn-small:hover {
  background: #4c4c4c;
}

.path-picker {
  position: absolute;
  background: #2d2d2d;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 4px;
}

.path-picker-item {
  padding: 8px 12px;
  font-size: 12px;
  color: #d4d4d4;
  cursor: pointer;
  white-space: nowrap;
}

.path-picker-item:hover {
  background: #3e3e42;
}

.search-history-dropdown {
  position: absolute;
  background: #2d2d2d;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-top: 4px;
  left: 16px;
  right: 16px;
}

.search-history-item {
  padding: 8px 12px;
  font-size: 12px;
  color: #d4d4d4;
  cursor: pointer;
  white-space: nowrap;
}

.search-history-item:hover {
  background: #3e3e42;
}

.search-history-item.selected {
  background: #094771;
}

.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.search-option {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #858585;
  cursor: pointer;
}

.search-option input {
  cursor: pointer;
}

.search-results {
  flex: 1;
  overflow-y: auto;
}

.search-empty {
  padding: 16px;
  color: #6a6a6a;
  font-size: 12px;
  text-align: center;
}

.search-warning {
  padding: 8px 16px;
  color: #e67700;
  font-size: 11px;
  background: #3d2e00;
}

.search-file-group {
  border-bottom: 1px solid #3e3e42;
}

.search-file-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  color: #d4d4d4;
  font-size: 12px;
}

.search-file-header:hover {
  background: #2a2d2e;
}

.expand-icon {
  font-size: 10px;
  color: #6a6a6a;
}

.search-result-file {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-count {
  font-size: 11px;
  color: #858585;
}

.search-file-matches {
  background: #1e1e1e;
}

.search-match-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 16px 4px 32px;
  cursor: pointer;
  font-size: 12px;
}

.search-match-item:hover {
  background: #2a2d2e;
}

.match-line {
  color: #858585;
  font-size: 11px;
  min-width: 40px;
}

.match-preview {
  flex: 1;
  color: #d4d4d4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
