import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { GAME_TITLE } from '@shared/constants'
import { registerIpc } from './ipc'

// Prefer the discrete GPU on dual-GPU laptops.
app.commandLine.appendSwitch('force_high_performance_gpu')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    fullscreen: true,
    title: GAME_TITLE,
    backgroundColor: '#0b0614',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The simulation must keep ticking when the host window loses focus.
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  win.removeMenu()
  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen())
    if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
})

app.on('window-all-closed', () => app.quit())
