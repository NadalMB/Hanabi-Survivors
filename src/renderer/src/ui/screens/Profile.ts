import { ACCOUNT_LEVEL_CAP, accountXpProgress } from '@shared/account'
import type { BattlePassSave, CosmeticLoadout, SaveData } from '@shared/save'
import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS } from '@/game/data/characters'
import { COSMETIC_ORDER } from '@/game/data/cosmetics'
import { ENEMIES } from '@/game/data/enemies'
import { skillPointsLeft } from '@/game/data/meta'
import { PASSIVES } from '@/game/data/passives'
import { PASS_LEVELS } from '@/game/data/battlePass'
import { WEAPONS } from '@/game/data/weapons'
import { el, formatTime } from '../dom'
import { screenFrame } from './common'

function clonePass(pass: BattlePassSave): BattlePassSave {
  return { season: pass.season, xp: pass.xp, premium: pass.premium, claimedFree: [...pass.claimedFree], claimedPremium: [...pass.claimedPremium] }
}

function cloneLoadout(loadout: CosmeticLoadout): CosmeticLoadout {
  return {
    characterSkins: { ...loadout.characterSkins },
    weaponSkins: { ...loadout.weaponSkins },
    ornament: loadout.ornament,
    pet: loadout.pet,
    effect: loadout.effect
  }
}

/** Swaps the whole catalog in, or puts the saved profile back. Gold, level and stats stay. */
function toggleUnlockAll(save: SaveData): void {
  if (save.devUnlock) {
    const back = save.devUnlock
    save.unlockedCharacters = [...back.unlockedCharacters]
    save.unlockedWeapons = [...back.unlockedWeapons]
    save.unlockedPassives = [...back.unlockedPassives]
    save.seenEnemies = [...back.seenEnemies]
    save.ownedCosmetics = [...back.ownedCosmetics]
    save.worldsReached = back.worldsReached
    save.battlePass = clonePass(back.battlePass)
    save.equipped = cloneLoadout(back.equipped)
    save.devUnlock = null
    return
  }
  save.devUnlock = {
    unlockedCharacters: [...save.unlockedCharacters],
    unlockedWeapons: [...save.unlockedWeapons],
    unlockedPassives: [...save.unlockedPassives],
    seenEnemies: [...save.seenEnemies],
    ownedCosmetics: [...save.ownedCosmetics],
    worldsReached: save.worldsReached,
    battlePass: clonePass(save.battlePass),
    equipped: cloneLoadout(save.equipped)
  }
  save.unlockedCharacters = [...CHARACTER_ORDER]
  save.unlockedWeapons = Object.keys(WEAPONS)
  save.unlockedPassives = Object.keys(PASSIVES)
  save.seenEnemies = ENEMIES.map((enemy) => enemy.type)
  save.ownedCosmetics = [...COSMETIC_ORDER]
  save.worldsReached = Math.max(save.worldsReached, 2)
  const claimed = Array.from({ length: PASS_LEVELS }, (_, index) => index)
  save.battlePass = { ...save.battlePass, premium: true, xp: 2_000_000, claimedFree: claimed, claimedPremium: claimed }
}

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

  const dev = el('div', 'profile-dev')
  const devBtn = el('button', `btn${save.devUnlock ? '' : ' primary'}`, save.devUnlock ? 'Volver a mi perfil' : 'Desbloquear todo')
  devBtn.addEventListener('click', () => {
    toggleUnlockAll(save)
    void app.persist()
    app.sfx.ui()
    app.profile()
  })
  dev.append(devBtn, el('p', 'profile-dev-note', 'Botón de prueba, hasta que el juego esté terminado. El oro, el nivel y las estadísticas no cambian.'))

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

  frame.body.append(hero, pointsRow, dev, grid, cast)
  return frame.root
}
