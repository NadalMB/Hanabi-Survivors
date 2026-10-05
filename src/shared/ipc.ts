import type { SaveData } from './save'

export const IPC = {
  saveLoad: 'save:load',
  saveWrite: 'save:write',
  saveFlush: 'save:flush',
  setFullscreen: 'window:set-fullscreen',
  quit: 'app:quit',
  soundtrack: 'audio:soundtrack',
  lanStart: 'lan:start',
  lanStop: 'lan:stop',
  lanAddresses: 'lan:addresses'
} as const

export type LanStartResult = { ok: true; port: number; addresses: string[] } | { ok: false; error: string }

/** API exposed to the renderer through the preload bridge as `window.api`. */
export interface GameApi {
  loadSave(): Promise<SaveData>
  writeSave(data: SaveData, gen: number): Promise<void>
  /** Writes before the window closes. The call returns only after the file is on disk. */
  flushSave(data: SaveData, gen: number): void
  setFullscreen(on: boolean): Promise<boolean>
  quit(): void
  /** Raw soundtrack bytes. Present in Electron; absent in a plain browser preview. */
  readSoundtrack(): Promise<Uint8Array>
  lan: {
    start(port: number): Promise<LanStartResult>
    stop(): Promise<void>
    addresses(): Promise<string[]>
  }
}
