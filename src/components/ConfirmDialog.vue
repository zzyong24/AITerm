<template>
  <div class="modal-overlay" @click="$emit('cancel')">
    <div class="modal confirm-modal" @click.stop>
      <div class="modal-header">
        <span>确认</span>
      </div>
      <div class="modal-body">
        <p>{{ message }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="$emit('cancel')">取消</button>
        <button class="btn-confirm danger" @click="$emit('confirm')">确认</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ConfirmDialog',

  props: {
    message: {
      type: String,
      required: true
    }
  },

  emits: ['confirm', 'cancel']
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
  overflow: hidden;
}

.confirm-modal {
  width: 350px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e42;
  font-size: 14px;
  font-weight: 500;
  color: #d4d4d4;
}

.modal-body {
  padding: 16px;
}

.modal-body p {
  color: #d4d4d4;
  line-height: 1.5;
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
}

.btn-cancel, .btn-confirm {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #3e3e42;
  color: #d4d4d4;
}

.btn-cancel:hover {
  background: #3e3e42;
}

.btn-confirm {
  background: #007acc;
  border: none;
  color: #fff;
}

.btn-confirm:hover {
  background: #005a9e;
}

.btn-confirm.danger {
  background: #c42b1c;
}

.btn-confirm.danger:hover {
  background: #d73424;
}
</style>
