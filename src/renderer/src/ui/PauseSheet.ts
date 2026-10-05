import { COSMETICS, playerSkinKey } from '@/game/data/cosmetics'
import { PASSIVES } from '@/game/data/passives'
import { BASE_STATS, describeMods, formatStat, STAT_LABELS, type StatKey } from '@/game/data/stats'
import { WEAPONS, weaponIconFrame, weaponStatsBeforePlayer, type WeaponStats } from '@/game/data/weapons'
import type { Player } from '@/game/sim/Player'
import { iconImg } from '@/render/icons'
import { el } from './dom'

const PERCENT: ReadonlySet<StatKey> = new Set(['moveSpeed', 'might', 'area', 'speed', 'duration', 'cooldown', 'magnet', 'luck', 'growth', 'greed', 'critChance'])

function currentStat(key: StatKey, value: number): string {
  if (PERCENT.has(key)) return `${Math.round(value * 100)}%`
  if (key === 'recovery') return `${value.toFixed(2)}/s`
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

function bonusText(delta: number, digits: number, suffix = ''): string | undefined {
  const abs = Math.abs(delta)
  if (abs < (digits === 0 ? 0.5 : 0.005)) return undefined
  const sign = delta > 0 ? '+' : ''
  const body = digits === 0 ? String(Math.round(delta)) : delta.toFixed(digits)
  return `${sign}${body}${suffix}`
}

function statLine(list: HTMLElement, label: string, value: string, bonus?: string): void {
  const li = el('li', 'pause-line')
  li.append(el('span', '', value ? `${label} ${value}` : label))
  if (bonus) li.append(el('span', 'pause-bonus', bonus))
  list.append(li)
}

function weaponLines(list: HTMLElement, own: WeaponStats, s: WeaponStats): void {
  statLine(list, 'Daño', String(Math.round(s.damage)), bonusText(s.damage - own.damage, 0))
  statLine(list, 'Enfriamiento', `${s.cooldown.toFixed(2)} s`, bonusText(s.cooldown - own.cooldown, 2, ' s'))
  statLine(list, 'Cantidad', String(Math.round(s.amount)), bonusText(s.amount - own.amount, 0))
  statLine(list, 'Área', `${Math.round(s.area * 100)}%`, bonusText((s.area - own.area) * 100, 0, '%'))
  statLine(list, 'Velocidad', `${Math.round(s.speed * 100)}%`, bonusText((s.speed - own.speed) * 100, 0, '%'))
  statLine(list, 'Duración', `${s.duration.toFixed(2)} s`, bonusText(s.duration - own.duration, 2, ' s'))
  statLine(list, 'Perforación', Number.isFinite(s.pierce) ? String(s.pierce) : '∞')
  statLine(list, 'Empuje', s.knockback.toFixed(1))
}

/** Pause inventory: character passive, loadout, cosmetics and live stats. In co-op, switch to another player. */
export function pauseSheet(players: readonly Player[], focusId: number, localId: number, onPick: () => void, onFocus: (id: number) => void): HTMLElement {
  const player = players.find((p) => p.id === focusId) ?? players[0]
  const sheet = el('div', 'pause-sheet')
  if (!player) return sheet
  if (players.length > 1) {
    const roster = el('div', 'pause-roster')
    for (const p of players) {
      const mine = p.id === localId
      const btn = el('button', `pause-roster-btn${p.id === player.id ? ' on' : ''}`, `${mine ? 'Tú' : p.name} · ${p.character.name}`) as HTMLButtonElement
      btn.addEventListener('click', () => {
        if (p.id === player.id) return
        onPick()
        onFocus(p.id)
      })
      roster.append(btn)
    }
    sheet.append(roster)
  }
  const board = el('div', 'pause-board')
  const items = el('div', 'pause-items')
  const side = el('div', 'pause-side')
  const detail = el('div', 'pause-detail')
  board.append(items, side)

  const buttons: HTMLButtonElement[] = []
  const select = (btn: HTMLButtonElement, fill: () => void): void => {
    for (const b of buttons) b.classList.toggle('on', b === btn)
    fill()
    onPick()
  }

  const group = (title: string): HTMLElement => {
    const box = el('section', 'pause-group')
    box.append(el('h3', 'pause-group-title', title))
    items.append(box)
    return box
  }

  const hero = group('Personaje')
  const character = player.character
  const signature = WEAPONS[character.weapon]
  const heroBtn = el('button', 'pause-item') as HTMLButtonElement
  heroBtn.append(
    iconImg(signature?.icon ?? 'omamori', 'passive', 'pause-item-icon'),
    el('span', 'pause-item-name', character.name),
    el('span', 'pause-item-lv', 'Pasiva')
  )
  heroBtn.addEventListener('click', () =>
    select(heroBtn, () => {
      const mods = describeMods(character.mods)
      detail.replaceChildren(
        el('div', 'pause-detail-kicker', 'Pasiva de personaje'),
        el('div', 'pause-detail-name', character.name),
        el('p', 'pause-detail-desc', character.title),
        el('p', 'pause-detail-desc', character.description),
        el('p', 'pause-detail-desc', mods ? `Siempre activa: ${mods}.` : 'Este personaje no añade una pasiva de estadísticas.')
      )
    })
  )
  buttons.push(heroBtn)
  hero.append(heroBtn)

  const weapons = group('Armas')
  weapons.classList.add('split')
  if (player.weapons.length === 0) weapons.append(el('p', 'pause-empty', 'Todavía no llevas armas.'))
  for (const slot of player.weapons) {
    const def = WEAPONS[slot.id]
    if (!def) continue
    const btn = el('button', 'pause-item') as HTMLButtonElement
    btn.append(iconImg(def.icon, weaponIconFrame(def), 'pause-item-icon'), el('span', 'pause-item-name', def.name), el('span', 'pause-item-lv', `Nv. ${slot.level}`))
    btn.addEventListener('click', () =>
      select(btn, () => {
        const kicker = def.prestige
          ? `Prestigio ${def.id.endsWith('_legendary') ? 'legendario' : def.id.endsWith('_epic') ? 'épico' : def.id.endsWith('_rare') ? 'raro' : 'común'}`
          : def.evolution
            ? 'Evolución'
            : 'Común'
        detail.replaceChildren(el('div', 'pause-detail-kicker', kicker), el('div', 'pause-detail-name', def.name), el('p', 'pause-detail-desc', def.description))
        const list = el('ul', 'pause-stat-list')
        weaponLines(list, weaponStatsBeforePlayer(def, slot.level, slot.prestige), slot.stats)
        detail.append(list)
      })
    )
    buttons.push(btn)
    weapons.append(btn)
  }

  const passives = group('Pasivas')
  passives.classList.add('split')
  if (player.passives.length === 0) passives.append(el('p', 'pause-empty', 'Todavía no llevas pasivas.'))
  for (const slot of player.passives) {
    const def = PASSIVES[slot.id]
    if (!def) continue
    const btn = el('button', 'pause-item') as HTMLButtonElement
    btn.append(iconImg(def.icon, 'passive', 'pause-item-icon'), el('span', 'pause-item-name', def.name), el('span', 'pause-item-lv', `Nv. ${slot.level}`))
    btn.addEventListener('click', () =>
      select(btn, () => {
        detail.replaceChildren(
          el('div', 'pause-detail-kicker', 'Pasiva'),
          el('div', 'pause-detail-name', def.name),
          el('p', 'pause-detail-desc', def.description),
          el('p', 'pause-detail-desc', 'Ahora mismo:')
        )
        const list = el('ul', 'pause-stat-list')
        for (const key of Object.keys(def.perLevel) as StatKey[]) {
          const total = (def.perLevel[key] ?? 0) * slot.power
          const text = PERCENT.has(key) ? `${total >= 0 ? '+' : ''}${Math.round(total * 100)}%` : `${total >= 0 ? '+' : ''}${Number(total.toFixed(2))}`
          statLine(list, STAT_LABELS[key], '', text)
        }
        detail.append(list)
      })
    )
    buttons.push(btn)
    passives.append(btn)
  }

  const cosmetics = el('section', 'pause-group')
  cosmetics.append(el('h3', 'pause-group-title', 'Skins equipadas'))
  const chips = el('div', 'pause-chips')
  const skinId = playerSkinKey(player.loadout, player.character.id)
  const chip = (id: string | undefined, fallback: string): void => {
    const def = id ? COSMETICS[id] : undefined
    chips.append(el('span', `pause-chip ${def?.rarity ?? ''}`, def?.name ?? fallback))
  }
  chip(skinId, player.character.name)
  for (const id of Object.values(player.loadout.weaponSkins)) if (id && COSMETICS[id]) chip(id, '')
  for (const id of [player.loadout.ornament, player.loadout.pet, player.loadout.effect]) if (id && COSMETICS[id]) chip(id, '')
  cosmetics.append(chips)

  const stats = el('section', 'pause-group')
  stats.append(el('h3', 'pause-group-title', 'Estadísticas'))
  const grid = el('div', 'pause-stats')
  for (const key of Object.keys(STAT_LABELS) as StatKey[]) {
    const row = el('div', 'pause-stat')
    const vals = el('span', 'pause-stat-vals')
    vals.append(el('b', '', currentStat(key, player.stats[key])))
    const delta = player.stats[key] - BASE_STATS[key]
    if (Math.abs(delta) >= (PERCENT.has(key) ? 0.005 : 0.01)) vals.append(el('span', 'pause-bonus', formatStat(key, delta)))
    row.append(el('span', '', STAT_LABELS[key]), vals)
    grid.append(row)
  }
  stats.append(grid)

  detail.append(el('p', 'pause-detail-desc', 'Pulsa el personaje, un arma o una pasiva para leer qué hace y sus números actuales.'))
  side.append(detail, cosmetics, stats)
  sheet.append(board)
  return sheet
}
