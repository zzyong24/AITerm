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
.confirm-modal {
  width: 350px;
}

.modal-body p {
  color: #d4d4d4;
  line-height: 1.5;
}

.btn-confirm.danger {
  background: #c42b1c;
}

.btn-confirm.danger:hover {
  background: #d73424;
}
</style>
