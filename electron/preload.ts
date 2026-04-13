import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, callback: (data: any) => void) => () => void
  off: (channel: string, callback: (data: any) => void) => void
}

const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, callback: (data: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  },
  off: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.removeListener(channel, callback as any)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
