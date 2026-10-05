import { app, BrowserWindow, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IPC, type LanStartResult } from '@shared/ipc'
import type { SaveData } from '@shared/save'
import { LanHub, localIPv4Addresses } from './lan/LanHub'
import { loadSave, writeSaveSync } from './saveStore'

const hub = new LanHub()

export function registerIpc(): void {
  ipcMain.handle(IPC.saveLoad, () => loadSave())
  ipcMain.handle(IPC.saveWrite, (_e, data: SaveData, gen: number) => writeSaveSync(data, gen))
  ipcMain.on(IPC.saveFlush, (e, data: SaveData, gen: number) => {
    writeSaveSync(data, gen)
    e.returnValue = true
  })

  ipcMain.handle(IPC.setFullscreen, (e, on: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false
    win.setFullScreen(on)
    return win.isFullScreen()
  })

  ipcMain.on(IPC.quit, () => app.quit())

  ipcMain.handle(IPC.soundtrack, () => {
    const path = app.isPackaged
      ? join(process.resourcesPath, 'bgm.mp3')
      : join(app.getAppPath(), 'src/renderer/src/audio/bgm.mp3')
    return readFile(path)
  })

  ipcMain.handle(IPC.lanStart, async (_e, port: number): Promise<LanStartResult> => {
    try {
      const bound = await hub.start(port)
      return { ok: true, port: bound, addresses: localIPv4Addresses() }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      return { ok: false, error: code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso.` : String(err) }
    }
  })
  ipcMain.handle(IPC.lanStop, () => hub.stop())
  ipcMain.handle(IPC.lanAddresses, () => localIPv4Addresses())

  app.on('before-quit', () => hub.stop())
}
