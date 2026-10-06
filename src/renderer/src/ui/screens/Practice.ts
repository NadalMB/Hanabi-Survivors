import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS, characterRevealed } from '@/game/data/characters'
import { PASSIVES } from '@/game/data/passives'
import { weaponFamily } from '@/game/data/prestige'
import { maxWeaponLevel, WEAPONS } from '@/game/data/weapons'
import type { PracticeLoadout, PracticeSlot } from '@/game/practice'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '@/game/sim/config'
import { isUnlocked } from './CharacterSelect'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { portraitFor, screenFrame } from './common'

const WEAPON_ORDER = ['katana', 'talisman', 'kunai', 'foxfire', 'thunder', 'aura', 'shuriken', 'hanabi']

function clampLevel(id: string, level: number, kind: 'weapon' | 'passive'): number {
  if (kind === 'weapon') return Math.max(1, Math.min(maxWeaponLevel(WEAPONS[id]), level))
  return Math.max(1, Math.min(PASSIVES[id].maxLevel, level))
}

function slotRow(
  label: string,
  level: number,
  max: number,
  onLevel: (n: number) => void,
  onRemove: () => void
): HTMLElement {
  const row = el('div', 'practice-slot')
  row.append(el('div', 'practice-slot-name', label))
  const lv = el('input', 'practice-level') as HTMLInputElement
  lv.type = 'number'
  lv.min = '1'
  lv.max = String(max)
  lv.value = String(level)
  lv.addEventListener('change', () => onLevel(Number(lv.value) || 1))
  const remove = el('button', 'btn small', 'Quitar')
  remove.addEventListener('click', onRemove)
  row.append(el('span', 'practice-slot-lv', 'Nv.'), lv, remove)
  return row
}

/** Album practice desk: pick a build, then jump into a sandbox run. */
export function practice(app: App): HTMLElement {
  const save = app.save
  const unlockedChars = CHARACTER_ORDER.filter((id) => characterRevealed(save, id) && isUnlocked(app, id))
  type CharId = (typeof CHARACTER_ORDER)[number]
  let characterId: CharId =
    unlockedChars.includes(save.lastCharacter as CharId) ? (save.lastCharacter as CharId) : unlockedChars[0] ?? 'sakura'
  const weapons: PracticeSlot[] = [{ id: CHARACTERS[characterId].weapon, level: 1 }]
  const passives: PracticeSlot[] = []

  const frame = screenFrame(
    'MODO PRÁCTICA',
    'Equipa lo que quieras al nivel que quieras e invoca enemigos en una arena sin recompensas.',
    save.gold,
    () => app.album()
  )

  const layout = el('div', 'practice-layout')
  const heroes = el('div', 'practice-heroes')
  const build = el('div', 'practice-build')
  const catalog = el('div', 'practice-catalog')
  layout.append(heroes, build, catalog)
  frame.body.append(layout)

  const renderHeroes = (): void => {
    heroes.replaceChildren(el('div', 'practice-section-title', 'Heroína'))
    const row = el('div', 'practice-hero-row')
    for (const id of unlockedChars.length ? unlockedChars : (['sakura'] as const)) {
      const def = CHARACTERS[id]
      const btn = el('button', `practice-hero${id === characterId ? ' on' : ''}`)
      const img = el('img') as HTMLImageElement
      img.src = portraitFor(app, id)
      btn.append(img, el('span', '', def.name))
      btn.addEventListener('click', () => {
        app.sfx.ui()
        characterId = id
        if (weapons.length === 0) weapons.push({ id: def.weapon, level: 1 })
        renderHeroes()
        renderBuild()
      })
      row.append(btn)
    }
    heroes.append(row)
  }

  const renderBuild = (): void => {
    build.replaceChildren(el('div', 'practice-section-title', 'Equipo'))
    const weaponBox = el('div', 'practice-box')
    weaponBox.append(el('div', 'practice-box-title', `Armas (${weapons.length}/${MAX_WEAPON_SLOTS})`))
    weapons.forEach((slot, index) => {
      const def = WEAPONS[slot.id]
      weaponBox.append(
        slotRow(
          def?.name ?? slot.id,
          slot.level,
          def ? maxWeaponLevel(def) : 8,
          (n) => {
            slot.level = clampLevel(slot.id, n, 'weapon')
            renderBuild()
          },
          () => {
            weapons.splice(index, 1)
            app.sfx.ui()
            renderBuild()
          }
        )
      )
    })
    build.append(weaponBox)

    const passiveBox = el('div', 'practice-box')
    passiveBox.append(el('div', 'practice-box-title', `Pasivas (${passives.length}/${MAX_PASSIVE_SLOTS})`))
    passives.forEach((slot, index) => {
      const def = PASSIVES[slot.id]
      passiveBox.append(
        slotRow(
          def?.name ?? slot.id,
          slot.level,
          def?.maxLevel ?? 8,
          (n) => {
            slot.level = clampLevel(slot.id, n, 'passive')
            renderBuild()
          },
          () => {
            passives.splice(index, 1)
            app.sfx.ui()
            renderBuild()
          }
        )
      )
    })
    build.append(passiveBox)

    const start = el('button', 'btn primary big', 'Empezar práctica')
    start.addEventListener('click', () => {
      app.sfx.ui()
      const loadout: PracticeLoadout = {
        characterId,
        weapons: weapons.map((w) => ({ id: w.id, level: clampLevel(w.id, w.level, 'weapon') })),
        passives: passives.map((p) => ({ id: p.id, level: clampLevel(p.id, p.level, 'passive') }))
      }
      app.startPractice(loadout)
    })
    build.append(start)
  }

  const renderCatalog = (): void => {
    catalog.replaceChildren(el('div', 'practice-section-title', 'Añadir al equipo'))
    const tabs = el('div', 'practice-mini-tabs')
    let mode: 'weapons' | 'passives' = 'weapons'
    const grid = el('div', 'practice-catalog-grid')

    const paint = (): void => {
      grid.replaceChildren()
      if (mode === 'weapons') {
        const sorted = Object.values(WEAPONS).sort(
          (a, b) => WEAPON_ORDER.indexOf(weaponFamily(a.id)) - WEAPON_ORDER.indexOf(weaponFamily(b.id))
        )
        for (const def of sorted) {
          const taken = weapons.some((w) => w.id === def.id)
          const full = weapons.length >= MAX_WEAPON_SLOTS
          const btn = el('button', `practice-catalog-card${taken || full ? ' dim' : ''}`)
          btn.append(iconImg(def.icon, 'weapon', 'practice-catalog-icon'), el('span', '', def.name))
          btn.disabled = taken || full
          btn.addEventListener('click', () => {
            if (taken || full) return
            weapons.push({ id: def.id, level: maxWeaponLevel(def) })
            app.sfx.ui()
            renderBuild()
            paint()
          })
          grid.append(btn)
        }
      } else {
        for (const def of Object.values(PASSIVES)) {
          const taken = passives.some((p) => p.id === def.id)
          const full = passives.length >= MAX_PASSIVE_SLOTS
          const btn = el('button', `practice-catalog-card${taken || full ? ' dim' : ''}`)
          btn.append(iconImg(def.icon, 'passive', 'practice-catalog-icon'), el('span', '', def.name))
          btn.disabled = taken || full
          btn.addEventListener('click', () => {
            if (taken || full) return
            passives.push({ id: def.id, level: def.maxLevel })
            app.sfx.ui()
            renderBuild()
            paint()
          })
          grid.append(btn)
        }
      }
    }

    const wTab = el('button', 'practice-mini-tab on', 'Armas')
    const pTab = el('button', 'practice-mini-tab', 'Pasivas')
    wTab.addEventListener('click', () => {
      mode = 'weapons'
      wTab.classList.add('on')
      pTab.classList.remove('on')
      paint()
    })
    pTab.addEventListener('click', () => {
      mode = 'passives'
      pTab.classList.add('on')
      wTab.classList.remove('on')
      paint()
    })
    tabs.append(wTab, pTab)
    catalog.append(tabs, grid)
    paint()
  }

  renderHeroes()
  renderBuild()
  renderCatalog()
  return frame.root
}
