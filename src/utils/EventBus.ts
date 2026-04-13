// 简单的事件总线，不依赖 reactive
type EventCallback = (...args: any[]) => void

class EventBusClass {
  private listeners: Map<string, EventCallback[]> = new Map()

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      // 使用过滤方式移除匹配的回调
      const filtered = callbacks.filter(cb => {
        // 移除无效回调和非匹配项
        return typeof cb !== 'function' || cb !== callback
      })
      this.listeners.set(event, filtered)
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(cb => {
        if (typeof cb === 'function') {
          cb(...args)
        }
      })
    }
  }
}

export const eventBus = new EventBusClass()
