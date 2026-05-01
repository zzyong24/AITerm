<template>
  <div class="kill-port-panel">
    <div class="panel-header">
      <span>终止端口进程</span>
    </div>
    <div class="panel-body">
      <div class="input-group">
        <label>端口号</label>
        <input v-model="killPortInput" type="number" placeholder="例如: 3001" @keydown.enter="handleKillPort" />
      </div>
      <button class="btn-kill" @click="handleKillPort">终止</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { killPort } from '../api'

export default defineComponent({
  name: 'KillPortPanel',
  data() {
    return {
      killPortInput: ''
    }
  },
  methods: {
    async handleKillPort() {
      const port = parseInt(this.killPortInput)
      if (isNaN(port) || port <= 0) {
        return
      }
      try {
        await killPort(port)
        this.killPortInput = ''
      } catch (e) {
        console.error('Failed to kill port:', e)
      }
    }
  }
})
</script>

<style scoped>
.kill-port-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #252526;
}

.panel-header {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #858585;
  border-bottom: 1px solid #3e3e42;
}

.panel-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-group label {
  font-size: 12px;
  color: #d4d4d4;
}

.input-group input {
  background: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #d4d4d4;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
}

.input-group input:focus {
  border-color: #007acc;
}

.btn-kill {
  background: #c42b1c;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-kill:hover {
  background: #a02622;
}
</style>
