<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal settings-modal" @click.stop>
      <div class="modal-header">
        <span>设置</span>
        <button class="modal-close" @click="$emit('close')">×</button>
      </div>
      <div class="modal-body">
        <div class="setting-item">
          <label>编辑器路径</label>
          <div class="path-input-row">
            <input
              v-model="editorPath"
              type="text"
              placeholder="例如: /Applications/Visual Studio Code.app"
            />
            <button @click="handleBrowse">浏览</button>
          </div>
          <p class="setting-hint">留空则自动检测，或手动指定 VS Code、Cursor 等编辑器</p>
        </div>
        <div class="setting-item">
          <label>终端字体大小</label>
          <input
            v-model.number="terminalFontSize"
            type="number"
            min="8"
            max="32"
            class="font-size-input"
          />
          <p class="setting-hint">范围: 8 ~ 32，默认 14</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-confirm" @click="handleSave">保存</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { appBusiness, AppEvents } from '../store/AppBusiness'
import { eventBus } from '../utils/EventBus'
import { pickDirectory as apiPickDirectory } from '../api'

export default defineComponent({
  name: 'Settings',

  emits: ['close'],

  data() {
    return {
      editorPath: '',
      terminalFontSize: 14
    }
  },

  mounted() {
    eventBus.on(AppEvents.SETTINGS_CHANGE, this.handleSettingsChange)
    this.editorPath = appBusiness.editorPath
    this.terminalFontSize = appBusiness.terminalFontSize
  },

  beforeUnmount() {
    eventBus.off(AppEvents.SETTINGS_CHANGE, this.handleSettingsChange)
  },

  methods: {
    handleSettingsChange(data: { sidebarCollapsed: boolean; showSettings: boolean; editorPath: string; terminalFontSize: number }) {
      this.editorPath = data.editorPath
      this.terminalFontSize = data.terminalFontSize
    },

    async handleBrowse() {
      const selected = await apiPickDirectory()
      if (selected) {
        if (selected.endsWith('.app')) {
          this.editorPath = selected
        } else {
          this.editorPath = selected
        }
      }
    },

    async handleSave() {
      appBusiness.setEditorPath(this.editorPath)
      const fontSize = Math.max(8, Math.min(32, Number(this.terminalFontSize) || 14))
      appBusiness.setTerminalFontSize(fontSize)
      this.$emit('close')
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
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 500px;
  max-width: 90vw;
}

.modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #d4d4d4;
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

.btn-confirm:hover {
  background: #1177bb;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item label {
  display: block;
  margin-bottom: 6px;
  color: #d4d4d4;
  font-weight: 500;
}

.path-input-row {
  display: flex;
  gap: 8px;
}

.path-input-row input {
  flex: 1;
  padding: 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 14px;
}

.path-input-row input:focus {
  outline: none;
  border-color: #007acc;
}

.path-input-row button {
  padding: 8px 12px;
  background: #0e639c;
  border: none;
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

.path-input-row button:hover {
  background: #1177bb;
}

.setting-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #858585;
}

.font-size-input {
  width: 80px;
  padding: 8px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 14px;
}

.font-size-input:focus {
  outline: none;
  border-color: #007acc;
}
</style>
