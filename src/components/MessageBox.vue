<template>
  <Teleport to="body">
    <div class="message-box-overlay" @click="handleOverlayClick">
      <div class="message-box" :class="type" @click.stop>
        <div class="message-box-header">
          <span class="message-box-title">{{ title }}</span>
          <button v-if="showClose" class="message-box-close" @click="handleClose">×</button>
        </div>
        <div class="message-box-body">
          <p>{{ message }}</p>
          <input
            v-if="type === 'prompt'"
            ref="inputRef"
            v-model="inputValue"
            class="message-box-input"
            :placeholder="placeholder"
            @keyup.enter="handleConfirm"
          />
        </div>
        <div class="message-box-footer">
          <button v-if="type === 'confirm' || type === 'prompt'" class="btn-cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn-confirm" :class="{ danger: type === 'confirm' }" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import { defineComponent, ref, nextTick } from 'vue'

export default defineComponent({
  name: 'MessageBox',

  props: {
    title: {
      type: String,
      default: '提示'
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String as () => 'alert' | 'confirm' | 'prompt',
      default: 'alert'
    },
    showClose: {
      type: Boolean,
      default: true
    },
    confirmText: {
      type: String,
      default: '确定'
    },
    cancelText: {
      type: String,
      default: '取消'
    },
    placeholder: {
      type: String,
      default: ''
    },
    defaultValue: {
      type: String,
      default: ''
    }
  },

  emits: ['confirm', 'cancel', 'close'],

  setup(props, { emit }) {
    const inputRef = ref<HTMLInputElement | null>(null)
    const inputValue = ref(props.defaultValue)

    const handleConfirm = () => {
      if (props.type === 'prompt') {
        emit('confirm', inputValue.value)
      } else {
        emit('confirm')
      }
    }

    const handleCancel = () => {
      emit('cancel')
    }

    const handleClose = () => {
      emit('close')
    }

    const handleOverlayClick = () => {
      if (props.type === 'alert') {
        emit('close')
      }
    }

    // 自动聚焦输入框
    nextTick(() => {
      if (props.type === 'prompt' && inputRef.value) {
        inputRef.value.focus()
      }
    })

    return {
      inputRef,
      inputValue,
      handleConfirm,
      handleCancel,
      handleClose,
      handleOverlayClick
    }
  }
})
</script>

<style scoped>
.message-box-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
}

.message-box {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  min-width: 320px;
  max-width: 480px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.message-box.confirm {
  border-color: #f48771;
}

.message-box-header {
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-box-title {
  font-weight: 600;
  color: #d4d4d4;
  font-size: 14px;
}

.message-box-close {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #858585;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-box-close:hover {
  background: #3e3e42;
  color: #d4d4d4;
}

.message-box-body {
  padding: 20px 16px;
}

.message-box-body p {
  color: #d4d4d4;
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 12px 0;
  word-break: break-word;
}

.message-box-input {
  width: 100%;
  padding: 8px 12px;
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.message-box-input:focus {
  border-color: #007acc;
}

.message-box-input::placeholder {
  color: #858585;
}

.message-box-footer {
  padding: 12px 16px;
  border-top: 1px solid #3e3e42;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.btn-cancel {
  background: #3e3e42;
  color: #d4d4d4;
}

.btn-cancel:hover {
  background: #4e4e4e;
}

.btn-confirm {
  background: #0e639c;
  color: #fff;
}

.btn-confirm:hover {
  background: #1177bb;
}

.btn-confirm.danger {
  background: #c42b1c;
}

.btn-confirm.danger:hover {
  background: #d13616;
}
</style>
