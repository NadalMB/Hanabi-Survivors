import { accountXpProgress } from '@shared/account'
import { GAME_VERSION } from '@shared/constants'
import type { CharacterRecord, SaveData } from '@shared/save'
import type { App } from '@/App'
import { CHARACTERS, CHARACTER_ORDER } from '@/game/data/characters'
import { skillPointsLeft } from '@/game/data/meta'
import { el, formatTime, whileMounted } from '../dom'
import { goldPill, portraitFor, profileAvatar } from './common'
import { isUnlocked } from './CharacterSelect'

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
  item('Tienda', 'Próximamente', () => app.boutique())
  item('Pase de batalla', 'Icono de perfil en el nivel 10 gratuito', () => app.battlePass())
  item('Álbum', 'Colección de heroínas, armas y enemigos', () => app.album())
  item('Habilidades', 'Árbol permanente por ramas', () => app.skills())
  item('Ajustes', 'Sonido y pantalla', () => app.settings())
  if (window.api) item('Salir', 'Cerrar el juego', () => window.api?.quit())

  left.append(logo, nav)

  const right = el('div', 'menu-right')
  const owned = CHARACTER_ORDER.filter((id) => isUnlocked(app, id))
  const roster = owned.length > 0 ? owned : (['sakura'] as const)
  const featured = mostPlayedId(save)
  let index = roster.findIndex((id) => id === featured)
  if (index < 0) index = 0
  const portrait = el('img', 'hero-portrait') as HTMLImageElement
  portrait.draggable = false
  const plate = el('div', 'hero-plate')
  const kicker = el('div', 'hero-kicker')
  const name = el('div', 'hero-name')
  const title = el('div', 'hero-title')
  const stats = el('div', 'hero-stats')
  plate.append(kicker, name, title, stats)
  const showHero = (id: string): void => {
    const def = CHARACTERS[id]
    if (!def) return
    portrait.src = portraitFor(app, id)
    kicker.textContent = id === featured ? 'LA MÁS JUGADA' : 'DESBLOQUEADA'
    name.textContent = def.name
    title.textContent = def.title
    const box = heroStats(save.characterStats[id])
    stats.replaceChildren(...Array.from(box.childNodes))
  }
  showHero(roster[index])
  if (roster.length > 1) {
    whileMounted(root, () => {
      index = (index + 1) % roster.length
      portrait.classList.remove('hero-swap')
      void portrait.offsetWidth
      portrait.classList.add('hero-swap')
      showHero(roster[index])
    }, 4500)
  }
  right.append(portrait, plate)

  const progress = accountXpProgress(save.accountXp)
  const points = skillPointsLeft(save)
  const chip = el('button', 'profile-chip')
  chip.append(profileAvatar(app, 'profile-avatar profile-avatar-sm', progress.level))
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
