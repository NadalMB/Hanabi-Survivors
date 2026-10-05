import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type GameApi } from '@shared/ipc'

const api: GameApi = {
  loadSave: () => ipcRenderer.invoke(IPC.saveLoad),
  writeSave: (data, gen) => ipcRenderer.invoke(IPC.saveWrite, data, gen),
  flushSave: (data, gen) => {
    ipcRenderer.sendSync(IPC.saveFlush, data, gen)
  },
  setFullscreen: (on) => ipcRenderer.invoke(IPC.setFullscreen, on),
  quit: () => ipcRenderer.send(IPC.quit),
  readSoundtrack: () => ipcRenderer.invoke(IPC.soundtrack),
  lan: {
    start: (port) => ipcRenderer.invoke(IPC.lanStart, port),
    stop: () => ipcRenderer.invoke(IPC.lanStop),
    addresses: () => ipcRenderer.invoke(IPC.lanAddresses)
  }
}

contextBridge.exposeInMainWorld('api', api)
