import { accountXpProgress } from '@shared/account'
import { GAME_VERSION } from '@shared/constants'
import type { CharacterRecord, SaveData } from '@shared/save'
import type { App } from '@/App'
import { CHARACTERS } from '@/game/data/characters'
import { skillPointsLeft } from '@/game/data/meta'
import { el, formatTime } from '../dom'
import { goldPill, portraitFor } from './common'

function mostPlayedId(save: SaveData): string {
  let pick = CHARACTERS[save.lastCharacter] ? save.lastCharacter : 'sakura'
  let runs = -1
  let time = -1
  for (const [id, row] of Object.entries(save.characterStats)) {
    if (!CHARACTERS[id]) continue
    if (row.runs > runs || (row.runs === runs && row.timePlayed > time)) {
      pick = id
      runs = row.runs
      time = row.timePlayed
    }
  }
  if (runs <= 0) return CHARACTERS[save.lastCharacter] ? save.lastCharacter : 'sakura'
  return pick
}

function formatPlayed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

function heroStats(row: CharacterRecord | undefined): HTMLElement {
  const record = row ?? { runs: 0, kills: 0, bestSurvivalSeconds: 0, timePlayed: 0, bossesDefeated: 0 }
  const box = el('div', 'hero-stats')
  box.append(
    el('div', 'hero-stat', `Partidas ${record.runs}`),
    el('div', 'hero-stat', `Tiempo jugado ${formatPlayed(record.timePlayed)}`),
    el('div', 'hero-stat', `Mejor tiempo ${formatTime(record.bestSurvivalSeconds)}`),
    el('div', 'hero-stat', `Bajas ${record.kills}`),
    el('div', 'hero-stat', `Jefes ${record.bossesDefeated}`)
  )
  return box
}

export function mainMenu(app: App): HTMLElement {
  const save = app.save
  const root = el('div', 'screen main-menu interactive visible')

  const left = el('div', 'menu-left')
  const logo = el('div', 'logo')
  logo.append(el('div', 'logo-kicker', '花火 · サバイバーズ'), el('div', 'logo-main', 'HANABI'), el('div', 'logo-sub', 'SURVIVORS'))

  const nav = el('nav', 'menu-nav')
  const item = (label: string, hint: string, run: () => void, primary = false): void => {
    const b = el('button', `menu-item${primary ? ' primary' : ''}`)
    b.append(el('span', 'menu-item-label', label), el('span', 'menu-item-hint', hint))
    b.addEventListener('click', () => {
      app.sfx.ui()
      run()
    })
    b.addEventListener('mouseenter', () => app.sfx.ui())
    nav.append(b)
  }
  item('Jugar', 'Partida en solitario', () => app.characterSelect(), true)
  item('Cooperativo', 'Online con código o red local', () => app.coopMenu())
  item('Tienda', 'Skins, mascotas y adornos · rota cada día', () => app.boutique())
  item('Pase de batalla', 'Progresión con recompensas exclusivas', () => app.battlePass())
  item('Álbum', 'Colección de heroínas, armas, pasivas y cosméticos', () => app.album())
  item('Habilidades', 'Árbol permanente por ramas', () => app.skills())
  item('Ajustes', 'Sonido y pantalla', () => app.settings())
  if (window.api) item('Salir', 'Cerrar el juego', () => window.api?.quit())

  left.append(logo, nav)

  const right = el('div', 'menu-right')
  const charId = mostPlayedId(save)
  const def = CHARACTERS[charId]
  const portrait = el('img', 'hero-portrait') as HTMLImageElement
  portrait.src = portraitFor(app, charId)
  portrait.draggable = false
  const plate = el('div', 'hero-plate')
  plate.append(el('div', 'hero-kicker', 'LA MÁS JUGADA'), el('div', 'hero-name', def.name), el('div', 'hero-title', def.title), heroStats(save.characterStats[charId]))
  right.append(portrait, plate)

  const progress = accountXpProgress(save.accountXp)
  const points = skillPointsLeft(save)
  const chip = el('button', 'profile-chip')
  chip.append(el('span', 'profile-chip-level', String(progress.level)))
  const chipCopy = el('span', 'profile-chip-copy')
  const chipBar = el('span', 'profile-chip-bar')
  const chipFill = el('span', 'profile-chip-fill')
  chipFill.style.width = `${Math.max(0, Math.min(1, progress.into / progress.need)) * 100}%`
  chipBar.append(chipFill)
  chipCopy.append(el('span', 'profile-chip-name', save.settings.playerName), chipBar)
  chip.append(chipCopy)
  if (points > 0) chip.append(el('span', 'profile-chip-points', String(points)))
  chip.addEventListener('click', () => {
    app.sfx.ui()
    app.profile()
  })

  const footer = el('footer', 'menu-footer')
  footer.append(goldPill(save.gold), el('span', 'menu-version', `v${GAME_VERSION}`))

  root.append(chip, left, right, footer)
  return root
}
