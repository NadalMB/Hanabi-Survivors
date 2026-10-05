import 'pixi.js/unsafe-eval'
import { Application } from 'pixi.js'
import { hydrateSave } from '@shared/save'
import { App } from './App'
import { Sfx } from './audio/Sfx'
import { Input } from './core/Input'
import { enableDragScroll } from './ui/dragScroll'
import { loadIconArt } from './render/icons'
import { createTextures, loadBossImages, loadCastImages, loadPetImages, loadProjectileCharms } from './render/textures'
import './styles/fonts.css'
import './styles/main.css'
import './styles/ui.css'
import './styles/menus.css'

if (import.meta.env.DEV) {
  const errors: string[] = []
  Object.assign(window, { __errors: errors })
  window.addEventListener('error', (e) => errors.push(`${e.message} @ ${e.filename}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason?.stack ?? e.reason)))
}

async function boot(): Promise<void> {
  enableDragScroll()
  const app = new Application()
  await app.init({
    resizeTo: window,
    background: '#0b0614',
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    preference: 'webgl',
    autoStart: false
  })
  document.getElementById('game')!.appendChild(app.canvas)

  // Bitmap fonts and Pixi text are rasterised once, so the web fonts must be ready first.
  await Promise.all([document.fonts.load('48px "Dela Gothic One"'), document.fonts.load('700 16px "M PLUS Rounded 1c"')]).catch(() => undefined)

  const save = hydrateSave(window.api ? await window.api.loadSave() : null)
  const [cast, bosses, petArt] = await Promise.all([loadCastImages(), loadBossImages(), loadPetImages(), loadIconArt(), loadProjectileCharms()])
  const sfx = new Sfx(save.settings)
  const game = new App({ app, textures: createTextures(cast, bosses, petArt), sfx, input: new Input(), save, debug: import.meta.env.DEV })
  if (save.settings.fullscreen) void window.api?.setFullscreen(true)

  const params = new URLSearchParams(location.search)
  if (import.meta.env.DEV && (params.has('autoplay') || params.has('ff') || params.has('solo'))) {
    game.startSolo(params.get('char') ?? 'sakura', {
      autoplay: params.has('autoplay'),
      fastForwardSeconds: Number(params.get('ff') ?? 0),
      god: params.has('god')
    })
  } else {
    game.mainMenu()
  }
  if (import.meta.env.DEV) Object.assign(window, { __app: game })
}

void boot()
