import type { GameApi } from '@shared/ipc'

declare module '*.png' {
  const src: string
  export default src
}

declare global {
  interface Window {
    /** Injected by the Electron preload; absent when the renderer runs in a plain browser (dev preview). */
    api?: GameApi
  }
}

export {}
