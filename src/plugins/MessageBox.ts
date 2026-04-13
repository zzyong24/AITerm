import { createApp, h } from 'vue'
import MessageBox from '../components/MessageBox.vue'

let container: HTMLElement | null = null
let app: any = null

function cleanup() {
  if (app) {
    app.unmount()
    app = null
  }
  if (container && container.parentNode) {
    container.parentNode.removeChild(container)
    container = null
  }
}

export function showMessageBox(options: {
  title?: string
  message: string
  type?: 'alert' | 'confirm' | 'prompt'
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
}): Promise<boolean | string> {
  // 清理旧的实例
  cleanup()

  // 创建新容器
  container = document.createElement('div')
  document.body.appendChild(container)

  // 创建 Promise 并渲染 MessageBox
  return new Promise((resolve) => {
    app = createApp({
      render() {
        return h(MessageBox, {
          ...options,
          onConfirm: (value?: any) => {
            resolve(value !== undefined ? value : true)
            cleanup()
          },
          onCancel: () => {
            resolve(false)
            cleanup()
          },
          onClose: () => {
            resolve(false)
            cleanup()
          }
        })
      }
    })
    app.mount(container)
  })
}

export function alert(message: string, title?: string): Promise<boolean> {
  return showMessageBox({ title: title || '提示', message, type: 'alert' }) as Promise<boolean>
}

export function confirm(message: string, title?: string): Promise<boolean> {
  return showMessageBox({ title: title || '确认', message, type: 'confirm' }) as Promise<boolean>
}

export function prompt(message: string, defaultValue?: string, title?: string): Promise<string | null> {
  return showMessageBox({ title: title || '输入', message, type: 'prompt', defaultValue: defaultValue || '' }) as Promise<string | null>
}
