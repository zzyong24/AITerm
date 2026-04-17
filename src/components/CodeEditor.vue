<template>
  <div class="code-editor" v-if="currentEditor">
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn" @click="toggleSearch" title="查找 (Ctrl+F)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
        <button class="toolbar-btn" @click="handleSave" title="保存 (Ctrl+S)" :disabled="!isModified">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
      </div>

      <!-- 文件名 -->
      <div class="file-name">{{ currentEditor.path.split('/').pop() }}</div>
    </div>

    <!-- 编辑器容器 -->
    <div ref="editorContainer" class="editor-container"></div>

    <!-- 底部状态栏 -->
    <div class="editor-statusbar">
      <div class="file-path" @click="copyPath" :title="'点击复制: ' + currentEditor.path">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>{{ currentEditor.path }}</span>
      </div>
    </div>
  </div>
  <div v-else class="no-editor">
    没有打开的文件
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, rectangularSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, search, openSearchPanel } from '@codemirror/search'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
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
      isModified: false,
      currentEditor: null as any
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
        console.log('[CodeEditor] currentEditor watch triggered', {
          newEditor: newEditor ? { id: newEditor.id, scrollToLine: newEditor.scrollToLine, scrollTrigger: (newEditor as any).scrollTrigger } : null,
          oldEditor: oldEditor ? { id: oldEditor.id, scrollToLine: oldEditor.scrollToLine, scrollTrigger: (oldEditor as any).scrollTrigger } : null
        })

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
    // 初始化 currentEditor 和 modified 状态
    if (this.editorId) {
      const editor = this.editors.find(e => e.id === this.editorId)
      this.currentEditor = editor || null
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
    getLanguageExtension(path: string) {
      const ext = path.split('.').pop()?.toLowerCase()
      switch (ext) {
        case 'js':
        case 'jsx':
          return javascript()
        case 'ts':
        case 'tsx':
          return javascript({ typescript: true })
        case 'html':
        case 'htm':
          return html()
        case 'css':
          return css()
        case 'md':
        case 'markdown':
          return markdown()
        case 'json':
          return json()
        case 'py':
        case 'python':
          return python()
        default:
          return []
      }
    },

    handleEditorsChange(editors: any[]) {
      this.editors = [...editors]
      // 直接更新 currentEditor
      if (this.editorId) {
        const editor = editors.find(e => e.id === this.editorId)
        this.currentEditor = editor || null
        this.isModified = editor?.modified || false
        if (this.currentEditor && this.currentEditor.scrollToLine) {
          const line = this.currentEditor.scrollToLine
          requestAnimationFrame(() => {
            this.scrollToLine(line)
            appBusiness.updateEditorScrollToLine(this.currentEditor.id, undefined as any)
          })
        }
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
          EditorView.theme({
            '&': {
              backgroundColor: '#ffffff',
              color: '#333333'
            },
            '.cm-content': {
              caretColor: '#333333'
            },
            '.cm-cursor': {
              borderLeftColor: '#333333'
            },
            '&.cm-focused .cm-activeLine': {
              backgroundColor: '#f5f5f5'
            },
            '.cm-activeLineGutter': {
              backgroundColor: '#e8e8e8'
            },
            '.cm-gutters': {
              backgroundColor: '#f8f8f8',
              color: '#999999',
              borderRight: '1px solid #e0e0e0'
            },
            '.cm-lineNumbers .cm-gutterElement': {
              padding: '0 8px 0 4px'
            }
          }),
          lineNumbers(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          this.getLanguageExtension(this.currentEditor.path),
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

      // 如果需要滚动到指定行，使用 requestAnimationFrame 确保编辑器已挂载
      if (this.currentEditor.scrollToLine) {
        const line = this.currentEditor.scrollToLine
        requestAnimationFrame(() => {
          this.scrollToLine(line)
          appBusiness.updateEditorScrollToLine(this.currentEditor.id, undefined as any)
        })
      }
    },

    scrollToLine(line: number) {
      console.log('[CodeEditor] scrollToLine called with line:', line)
      if (!this.editorView || line === undefined || line === null || line <= 0) {
        return
      }
      // 使用 CodeMirror 6 官方 API 滚动和设置光标位置
      try {
        const editor = this.editorView
        const state = editor.state
        if (state?.doc && line >= 1 && line <= state.doc.lines) {
          const lineInfo = state.doc.line(line)
          // 滚动到指定行并将光标设置到该行
          editor.dispatch({
            selection: EditorSelection.cursor(lineInfo.from),
            effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center', yMargin: 100 }) // 增加边距让滚动更明显
          })
        } else {
          console.log('[CodeEditor] Invalid line or state.doc not available', {
            hasDoc: !!state?.doc,
            line,
            totalLines: state?.doc?.lines
          })
        }
      } catch (e) {
        console.error('[CodeEditor] Scroll to line failed:', e)
      }
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
        openSearchPanel(this.editorView as any)
      }
    },

    async copyPath() {
      if (this.currentEditor?.path) {
        try {
          await navigator.clipboard.writeText(this.currentEditor.path)
          alert('路径已复制')
        } catch (e) {
          console.error('Failed to copy path:', e)
        }
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
  background: #ffffff;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
  background: #f3f3f3;
  border-bottom: 1px solid #d4d4d4;
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
  color: #666666;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover {
  background: #e0e0e0;
  color: #333333;
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.file-name {
  color: #666666;
  font-size: 12px;
}

.editor-container {
  flex: 1;
  overflow: hidden;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
  background: #ffffff;
}

.editor-container :deep(.cm-editor .cm-content) {
  caret-color: #333333;
}

.editor-container :deep(.cm-editor .cm-cursor) {
  border-left-color: #333333;
}

.editor-container :deep(.cm-editor .cm-activeLine) {
  background-color: #f5f5f5;
}

.editor-container :deep(.cm-editor .cm-gutters) {
  background-color: #f8f8f8;
  border-right: 1px solid #e0e0e0;
  color: #999999;
}

.editor-container :deep(.cm-editor .cm-activeLineGutter) {
  background-color: #e8e8e8;
}

.editor-container :deep(.cm-scroller) {
  overflow: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  background: #ffffff;
  color: #333333;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.editor-container :deep(.cm-content) {
  user-select: text !important;
  -webkit-user-select: text !important;
}

.editor-container :deep(.cm-line) {
  user-select: text !important;
  -webkit-user-select: text !important;
}

.editor-container :deep(.cm-editor ::selection) {
  background: #add6ff !important;
}

.editor-container :deep(.cm-editor .cm-selectionBackground) {
  background: #add6ff !important;
}

.editor-container :deep(.cm-editor.cm-focused .cm-selectionBackground) {
  background: #add6ff !important;
}

.no-editor {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666666;
  font-size: 14px;
}

/* Search panel styling */
.editor-container :deep(.cm-panel.cm-search) {
  background: #f3f3f3;
  border-bottom: 1px solid #d4d4d4;
  padding: 8px;
}

.editor-container :deep(.cm-panel.cm-search input) {
  background: #ffffff;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  color: #333333;
  padding: 4px 8px;
  font-size: 12px;
}

.editor-container :deep(.cm-panel.cm-search input:focus) {
  border-color: #007acc;
  outline: none;
}

.editor-container :deep(.cm-panel.cm-search button) {
  background: #e0e0e0;
  border: none;
  border-radius: 4px;
  color: #333333;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}

.editor-container :deep(.cm-panel.cm-search button:hover) {
  background: #d0d0d0;
  color: #000000;
}

.editor-container :deep(.cm-panel.cm-search label) {
  color: #666666;
  font-size: 12px;
}

.editor-statusbar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: #f3f3f3;
  border-top: 1px solid #d4d4d4;
  min-height: 28px;
}

.file-path {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666666;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.15s;
  max-width: 100%;
  overflow: hidden;
}

.file-path:hover {
  background: #e0e0e0;
  color: #333333;
}

.file-path svg {
  flex-shrink: 0;
}

.file-path span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
