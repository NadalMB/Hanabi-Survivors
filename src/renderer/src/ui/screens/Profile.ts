import { ACCOUNT_LEVEL_CAP, accountXpProgress } from '@shared/account'
import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS } from '@/game/data/characters'
import { COSMETIC_ORDER } from '@/game/data/cosmetics'
import { ENEMIES } from '@/game/data/enemies'
import { skillPointsLeft } from '@/game/data/meta'
import { PASSIVES } from '@/game/data/passives'
import { WEAPONS } from '@/game/data/weapons'
import { el, formatTime } from '../dom'
import { screenFrame } from './common'

function formatPlayed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `${hours} h ${minutes} min`
  return `${minutes} min`
}

export function profile(app: App): HTMLElement {
  const save = app.save
  const frame = screenFrame('PERFIL', 'Tu nombre, tu nivel y todo lo que has sobrevivido', save.gold, () => app.mainMenu())

  const progress = accountXpProgress(save.accountXp)
  const points = skillPointsLeft(save)
  const maxed = progress.level >= ACCOUNT_LEVEL_CAP

  const hero = el('div', 'profile-hero')
  const badge = el('div', 'profile-badge', String(progress.level))
  const copy = el('div', 'profile-hero-copy')
  const name = el('input', 'text-input profile-name') as HTMLInputElement
  name.maxLength = 16
  name.value = save.settings.playerName
  name.addEventListener('change', () => {
    save.settings.playerName = name.value.trim().slice(0, 16) || 'Jugador'
    name.value = save.settings.playerName
    void app.persist()
    app.restartPresence()
    app.sfx.ui()
  })
  const bar = el('div', 'profile-bar')
  const fill = el('span', 'profile-bar-fill')
  fill.style.width = `${Math.max(0, Math.min(1, progress.into / progress.need)) * 100}%`
  bar.append(fill)
  const xpLine = maxed
    ? 'Nivel máximo'
    : `${progress.into.toLocaleString('es-ES')} / ${progress.need.toLocaleString('es-ES')} XP`
  copy.append(name, el('div', 'profile-level-label', maxed ? 'NIVEL MÁXIMO' : `NIVEL ${progress.level}`), bar, el('div', 'profile-xp', xpLine))
  hero.append(badge, copy)

  const pointsRow = el('div', 'profile-points')
  pointsRow.append(
    el('div', 'profile-points-value', points.toLocaleString('es-ES')),
    el('div', 'profile-points-label', points === 1 ? 'punto de habilidad sin gastar' : 'puntos de habilidad sin gastar')
  )
  const openTree = el('button', 'btn primary', 'Árbol de habilidades')
  openTree.addEventListener('click', () => {
    app.sfx.ui()
    app.skills('profile')
  })
  pointsRow.append(openTree)

  const stats = save.stats
  const grid = el('div', 'profile-stats')
  const cell = (label: string, value: string): void => {
    const box = el('div', 'profile-stat')
    box.append(el('div', 'profile-stat-value', value), el('div', 'profile-stat-label', label))
    grid.append(box)
  }
  cell('Tiempo jugado', formatPlayed(stats.timePlayed))
  cell('Partidas', stats.totalRuns.toLocaleString('es-ES'))
  cell('Bajas', stats.totalKills.toLocaleString('es-ES'))
  cell('Jefes', stats.bossesDefeated.toLocaleString('es-ES'))
  cell('Mejor supervivencia', formatTime(stats.bestSurvivalSeconds))
  cell('Oro', save.gold.toLocaleString('es-ES'))
  cell('Armas', `${save.unlockedWeapons.length} / ${Object.keys(WEAPONS).length}`)
  cell('Pasivas', `${save.unlockedPassives.length} / ${Object.keys(PASSIVES).length}`)
  cell('Enemigos', `${save.seenEnemies.length} / ${ENEMIES.length}`)
  cell('Cosméticos', `${save.ownedCosmetics.length} / ${COSMETIC_ORDER.length}`)

  const cast = el('div', 'profile-cast')
  cast.append(el('div', 'profile-cast-title', 'HEROÍNAS'))
  const played = CHARACTER_ORDER.filter((id) => (save.characterStats[id]?.runs ?? 0) > 0 || (save.characterStats[id]?.timePlayed ?? 0) > 0)
  if (played.length === 0) {
    cast.append(el('p', 'profile-empty', 'Aún no has terminado ninguna noche.'))
  } else {
    played.sort((a, b) => (save.characterStats[b]?.timePlayed ?? 0) - (save.characterStats[a]?.timePlayed ?? 0))
    for (const id of played) {
      const row = save.characterStats[id]
      const def = CHARACTERS[id]
      if (!def || !row) continue
      const card = el('div', 'profile-heroine')
      card.append(
        el('div', 'profile-heroine-name', def.name),
        el('div', 'profile-heroine-line', `${row.runs} partidas · ${formatPlayed(row.timePlayed)} · mejor ${formatTime(row.bestSurvivalSeconds)}`),
        el('div', 'profile-heroine-line', `${row.kills.toLocaleString('es-ES')} bajas · ${row.bossesDefeated} jefes`)
      )
      cast.append(card)
    }
  }

  frame.body.append(hero, pointsRow, grid, cast)
  return frame.root
}
