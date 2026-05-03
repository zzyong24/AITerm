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
        <button class="toolbar-btn" @click="handleRefresh" title="刷新">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        <button v-if="isMarkdown" class="toolbar-btn" :class="{ active: isPreview }" @click="togglePreview" title="预览">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <!-- 文件名 -->
      <div class="file-name">{{ currentEditor.path.split('/').pop() }}</div>
    </div>

    <!-- 编辑器容器 -->
    <div v-show="!isPreview" ref="editorContainer" class="editor-container"></div>

    <!-- 预览容器 -->
    <div v-if="isPreview" ref="previewContainer" class="preview-container markdown-body"></div>

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
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection } from '@codemirror/view'
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
import { writeFile as apiWriteFile, readFile as apiReadFile } from '../api'
import { alert } from '../plugins/MessageBox'
import { marked } from 'marked'
import mermaid from 'mermaid'

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
      currentEditor: null as any,
      isMarkdown: false,
      isPreview: false,
      lastEditorId: null as string | null
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
          this.isPreview = false
          this.$nextTick(() => {
            this.initEditor()
          })
        } else if (this.editorView && newEditor.content !== this.getEditorContent()) {
          this.editorView.dispatch({
            changes: {
              from: 0,
              to: this.editorView.state.doc.length,
              insert: newEditor.content
            }
          })
        }
      },
      immediate: false
    }
  },

  mounted() {
    eventBus.on(AppEvents.EDITORS_CHANGE, this.handleEditorsChange)

    this.editors = [...appBusiness.editors]
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
      if (this.editorId) {
        const editor = editors.find(e => e.id === this.editorId)
        this.currentEditor = editor || null
        this.isModified = editor?.modified || false
        this.isMarkdown = !!this.currentEditor?.path?.match(/\.(md|markdown)$/i)
        if (editor && this.lastEditorId !== editor.id) {
          this.isPreview = false
        }
        this.lastEditorId = editor?.id || null
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

      // 同步计算 isMarkdown
      this.isMarkdown = !!this.currentEditor?.path?.match(/\.(md|markdown)$/i)

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

      if (this.currentEditor.scrollToLine) {
        const line = this.currentEditor.scrollToLine
        requestAnimationFrame(() => {
          this.scrollToLine(line)
          appBusiness.updateEditorScrollToLine(this.currentEditor.id, undefined as any)
        })
      }
    },

    scrollToLine(line: number) {
      if (!this.editorView || line === undefined || line === null || line <= 0) return
      try {
        const editor = this.editorView
        const state = editor.state
        if (state?.doc && line >= 1 && line <= state.doc.lines) {
          const lineInfo = state.doc.line(line)
          editor.dispatch({
            selection: EditorSelection.cursor(lineInfo.from),
            effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center', yMargin: 100 })
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

    async handleRefresh() {
      if (!this.currentEditor) return
      this.$nextTick(async () => {
        try {
          const content = await apiReadFile(this.currentEditor.path)
          if (this.editorView) {
            this.editorView.dispatch({
              changes: {
                from: 0,
                to: this.editorView.state.doc.length,
                insert: content
              }
            })
          }
          appBusiness.updateEditorContent(this.currentEditor.id, content)
        } catch (e) {
          alert(`刷新失败: ${e}`)
        }
      })
    },

    toggleSearch() {
      if (this.editorView) {
        openSearchPanel(this.editorView as any)
      }
    },

    togglePreview() {
      this.isPreview = !this.isPreview
      if (this.isPreview) {
        this.$nextTick(() => {
          this.renderPreview()
        })
      } else {
        // When exiting preview, ensure editor gets focus back
        this.$nextTick(() => {
          this.editorView?.focus()
        })
      }
    },

    async renderPreview() {
      if (!this.$refs.previewContainer) return
      const container = this.$refs.previewContainer as HTMLElement
      const content = this.getEditorContent()

      // 配置 marked 解析代码块 - marked v18 uses token objects for renderer
      const renderer = new marked.Renderer()
      renderer.code = function({ text, lang }: { text: string; lang?: string }): string {
        if (lang === 'mermaid') {
          const id = `mermaid-${Date.now()}`
          // Store original code in data attribute for later rendering
          return `<div class="mermaid" data-code="${encodeURIComponent(text)}" data-mermaid-id="${id}"></div>`
        }
        return `<pre><code class="language-${lang || ''}">${text}</code></pre>`
      }

      marked.setOptions({ renderer })

      // 解析 markdown
      const htmlContent = marked.parse(content) as string
      container.innerHTML = htmlContent

      // 渲染所有 mermaid 图表
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: '#ffffff',
          primaryColor: '#007acc',
          primaryTextColor: '#333333',
          primaryBorderColor: '#d4d4d4',
          lineColor: '#333333',
          secondaryColor: '#f6f8fa',
          tertiaryColor: '#ffffff'
        },
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        securityLevel: 'loose'
      })

      const mermaidDivs = container.querySelectorAll('.mermaid')
      for (const div of mermaidDivs) {
        const code = decodeURIComponent(div.getAttribute('data-code') || '')
        const id = div.getAttribute('data-mermaid-id') || `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        try {
          const result = await mermaid.render(id, code)
          div.innerHTML = result.svg
          // 移除 SVG 中可能的深色 rect 背景，强制透明
          const svg = div.querySelector('svg')
          if (svg) {
            svg.style.backgroundColor = 'transparent'
            // 移除所有 rect 元素的 fill 属性
            svg.querySelectorAll('rect').forEach(rect => {
              rect.removeAttribute('fill')
            })
          }
        } catch (e) {
          div.innerHTML = `<div class="mermaid-error">渲染失败: ${e}</div>`
        }
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

.toolbar-btn.active {
  background: #007acc;
  color: #ffffff;
}

.toolbar-btn.active:hover {
  background: #005a9e;
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
  border-left-color: '#333333';
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

/* Preview container - markdown styling */
.preview-container {
  flex: 1;
  overflow: auto;
  padding: 20px 40px;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.preview-container :deep(h1),
.preview-container :deep(h2),
.preview-container :deep(h3),
.preview-container :deep(h4),
.preview-container :deep(h5),
.preview-container :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
  color: #1f2328;
}

.preview-container :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.preview-container :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.preview-container :deep(p) {
  margin-bottom: 16px;
  line-height: 1.6;
  color: #333333;
}

.preview-container :deep(pre) {
  line-height: 1.6;
}

.preview-container :deep(pre) {
  background-color: #f6f8fa;
  border-radius: 3px;
  padding: 16px;
  overflow: auto;
  margin-bottom: 16px;
}

.preview-container :deep(code) {
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  padding: 0.2em 0.4em;
  font-size: 85%;
  color: #333333;
}

.preview-container :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.preview-container :deep(.mermaid) {
  text-align: center;
  margin: 20px 0;
  background: #ffffff;
  border-radius: 4px;
  overflow: hidden;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-container :deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
  background: #ffffff;
}

.preview-container :deep(.mermaid-error) {
  color: #d73a49;
  padding: 12px;
  background: #fef2f2;
  border-radius: 4px;
}

.preview-container :deep(blockquote) {
  padding: 0 15px;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin: 0 0 16px 0;
}

.preview-container :deep(ul),
.preview-container :deep(ol) {
  padding-left: 2em;
  margin-bottom: 16px;
  color: #333333;
}

.preview-container :deep(li) {
  line-height: 1.6;
  color: #333333;
}

.preview-container :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

.preview-container :deep(th),
.preview-container :deep(td) {
  padding: 8px 13px;
  border: 1px solid #dfe2e5;
  color: #333333;
}

.preview-container :deep(th) {
  background-color: #f6f8fa;
}

.preview-container :deep(tr:nth-child(even)) {
  background-color: #fafbfc;
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
