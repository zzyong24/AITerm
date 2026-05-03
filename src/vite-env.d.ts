/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  invoke<T = any>(channel: string, ...args: any[]): Promise<T>
  on: (channel: string, callback: (data: any) => void) => () => void
  off: (channel: string, callback: (data: any) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
