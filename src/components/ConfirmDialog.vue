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
  background: #ffffff;
  border: 1px solid #d4d4d4;
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
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  font-weight: 500;
  color: #333333;
}

.modal-body {
  padding: 16px;
}

.modal-body p {
  color: #333333;
  line-height: 1.5;
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel,
.btn-confirm {
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
