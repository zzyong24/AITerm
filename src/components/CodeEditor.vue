<template>
  <div class="code-editor" v-if="currentEditor">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn" @click="toggleSearch" title="查找 (Ctrl+F)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        <button class="toolbar-btn" @click="handleSave" title="保存 (Ctrl+S)" :disabled="!isModified">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
      </div>

      <!-- 文件名 -->
      <div class="file-name">{{ currentEditor.path.split('/').pop() }}</div>
    </div>

    <!-- 编辑器容器 -->
    <div ref="editorContainer" class="editor-container"></div>
  </div>
  <div v-else class="no-editor">
    没有打开的文件
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, search, openSearchPanel } from '@codemirror/search'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { appBusiness, AppEvents } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import { writeFile as apiWriteFile } from '../api'
import { alert } from '../plugins/MessageBox'

export default defineComponent({
  name: 'CodeEditor',

  props: {
    editorId: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      editors: [] as any[],
      editorView: null as EditorView | null,
      isModified: false
    }
  },

  computed: {
    currentEditor() {
      if (this.editorId) {
        return this.editors.find(e => e.id === this.editorId) || null
      }
      return null
    }
  },

  watch: {
    editorId() {
      this.$nextTick(() => {
        this.initEditor()
      })
    },
    currentEditor: {
      handler(newEditor, oldEditor) {
        if (!newEditor) return
        if (oldEditor?.id !== newEditor?.id) {
          this.$nextTick(() => {
            this.initEditor()
          })
        } else if (this.editorView && newEditor.content !== this.getEditorContent()) {
          // 内容被外部更新（如替换操作），同步到编辑器
          const transaction = this.editorView.state.update({
            changes: {
              from: 0,
              to: this.editorView.state.doc.length,
              insert: newEditor.content
            }
          })
          this.editorView.dispatch(transaction)
        }
      },
      immediate: false
    }
  },

  mounted() {
    eventBus.on(AppEvents.EDITORS_CHANGE, this.handleEditorsChange)

    // 初始化数据
    this.editors = [...appBusiness.editors]
    // 初始化 modified 状态
    if (this.editorId) {
      const editor = this.editors.find(e => e.id === this.editorId)
      this.isModified = editor?.modified || false
    }

    this.$nextTick(() => {
      this.initEditor()
    })
  },

  beforeUnmount() {
    eventBus.off(AppEvents.EDITORS_CHANGE, this.handleEditorsChange)
    if (this.editorView) {
      this.editorView.destroy()
    }
  },

  methods: {
    handleEditorsChange(editors: any[]) {
      this.editors = [...editors]
      // 同步 modified 状态
      if (this.editorId) {
        const editor = editors.find(e => e.id === this.editorId)
        this.isModified = editor?.modified || false
      }
    },

    getEditorContent(): string {
      return this.editorView?.state.doc.toString() || ''
    },

    initEditor() {
      if (!this.currentEditor || !this.$refs.editorContainer) return

      // 销毁旧的编辑器
      if (this.editorView) {
        this.editorView.destroy()
        this.editorView = null
      }

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && this.editorId) {
          const content = update.state.doc.toString()
          appBusiness.updateEditorContent(this.editorId, content)
        }
      })

      const saveKeymap = keymap.of([{
        key: 'Mod-s',
        run: () => {
          this.handleSave()
          return true
        }
      }])

      const state = EditorState.create({
        doc: this.currentEditor.content,
        extensions: [
          oneDark,
          lineNumbers(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          rectangularSelection(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab
          ]),
          saveKeymap,
          search({ top: true }),
          updateListener,
          EditorView.lineWrapping
        ]
      })

      this.editorView = new EditorView({
        state,
        parent: this.$refs.editorContainer as HTMLElement
      })
    },

    handleSave() {
      if (!this.currentEditor || !this.currentEditor.modified) return
      this.$nextTick(async () => {
        try {
          await apiWriteFile(this.currentEditor.path, this.getEditorContent())
          appBusiness.markEditorSaved(this.currentEditor.id)
        } catch (e) {
          alert(`保存失败: ${e}`)
        }
      })
    },

    toggleSearch() {
      if (this.editorView) {
        openSearchPanel(this.editorView)
      }
    }
  }
})
</script>

<style scoped>
.code-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  min-height: 36px;
}

.toolbar-left {
  display: flex;
  gap: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.file-name {
  color: #858585;
  font-size: 12px;
}

.editor-container {
  flex: 1;
  overflow: hidden;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.no-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #858585;
  font-size: 14px;
}

/* Search panel styling */
.editor-container :deep(.cm-panel.cm-search) {
  background: #252526;
  border-bottom: 1px solid #3e3e42;
  padding: 8px;
}

.editor-container :deep(.cm-panel.cm-search input) {
  background: #3e3e42;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 4px 8px;
  font-size: 12px;
}

.editor-container :deep(.cm-panel.cm-search input:focus) {
  border-color: #007acc;
  outline: none;
}

.editor-container :deep(.cm-panel.cm-search button) {
  background: #3e3e42;
  border: none;
  border-radius: 4px;
  color: #858585;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}

.editor-container :deep(.cm-panel.cm-search button:hover) {
  background: #4e4e4e;
  color: #d4d4d4;
}

.editor-container :deep(.cm-panel.cm-search label) {
  color: #858585;
  font-size: 12px;
}
</style>
