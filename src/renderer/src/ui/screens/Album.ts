import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS } from '@/game/data/characters'
import {
  COSMETICS,
  COSMETIC_ORDER,
  KIND_LABEL,
  equipCosmetic,
  isEquipped,
  ownsCosmetic,
  unequipCosmetic,
  type CosmeticKind,
  type Rarity
} from '@/game/data/cosmetics'
import { ENEMIES, enemyRarity } from '@/game/data/enemies'
import { PASSIVES } from '@/game/data/passives'
import { weaponFamily } from '@/game/data/prestige'
import { describeMods } from '@/game/data/stats'
import { maxWeaponLevel, WEAPONS, weaponIconFrame, weaponLootRarity } from '@/game/data/weapons'
import { isUnlocked } from './CharacterSelect'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { cosmeticArt, portraitFor, rarityBadge, screenFrame } from './common'

type Tab = 'characters' | 'weapons' | 'passives' | 'enemies' | 'bosses' | CosmeticKind

const WEAPON_ORDER = ['katana', 'talisman', 'kunai', 'foxfire', 'thunder', 'aura', 'shuriken', 'hanabi']
const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, exclusive: 4 }

const TABS: { id: Tab; label: string }[] = [
  { id: 'characters', label: 'Heroínas' },
  { id: 'weapons', label: 'Armas' },
  { id: 'passives', label: 'Pasivas' },
  { id: 'enemies', label: 'Enemigos' },
  { id: 'bosses', label: 'Jefes' },
  { id: 'character_skin', label: KIND_LABEL.character_skin },
  { id: 'weapon_skin', label: KIND_LABEL.weapon_skin },
  { id: 'ornament', label: KIND_LABEL.ornament },
  { id: 'pet', label: KIND_LABEL.pet },
  { id: 'effect', label: KIND_LABEL.effect }
]

function cardLabel(name: string, maxLevel: number): HTMLElement {
  const label = el('div', 'album-card-name')
  label.append(el('span', '', name), el('span', 'album-card-lv', `Máx. ${maxLevel}`))
  return label
}

export function album(app: App): HTMLElement {
  const save = app.save
  const frame = screenFrame('ÁLBUM', 'Todo lo que existe en Hanabi Survivors. Lo bloqueado se ve en silueta.', save.gold, () => app.mainMenu())
  let tab: Tab = 'characters'
  let selected = ''

  const tabs = el('div', 'album-tabs')
  const layout = el('div', 'album-layout')
  const grid = el('div', 'album-grid')
  const detail = el('div', 'album-detail')
  layout.append(grid, detail)
  frame.body.append(tabs, layout)

  const countLine = (owned: number, total: number): string => `${owned} / ${total} descubiertos`

  const renderTabs = (): void => {
    tabs.replaceChildren()
    for (const t of TABS) {
      const b = el('button', `album-tab${t.id === tab ? ' on' : ''}`, t.label)
      b.addEventListener('click', () => {
        app.sfx.ui()
        tab = t.id
        selected = ''
        renderTabs()
        renderGrid()
        renderDetail()
      })
      tabs.append(b)
    }
  }

  const items = (): { id: string; owned: boolean; group?: string }[] => {
    if (tab === 'characters') return CHARACTER_ORDER.map((id) => ({ id, owned: isUnlocked(app, id) }))
    if (tab === 'weapons') {
      const known = new Set(save.unlockedWeapons)
      const rank = (id: string): number => {
        const def = WEAPONS[id]
        if (def.prestige && id.endsWith('_common')) return 1
        if (def.prestige && id.endsWith('_rare')) return 2
        if (def.prestige && id.endsWith('_epic')) return 3
        if (def.prestige && id.endsWith('_legendary')) return 4
        if (def.evolution) return 5
        return 0
      }
      return Object.values(WEAPONS)
        .map((w) => ({ id: w.id, owned: known.has(w.id) }))
        .sort((a, b) => WEAPON_ORDER.indexOf(weaponFamily(a.id)) - WEAPON_ORDER.indexOf(weaponFamily(b.id)) || rank(a.id) - rank(b.id))
    }
    if (tab === 'passives') {
      const known = new Set(save.unlockedPassives)
      return Object.keys(PASSIVES).map((id) => ({ id, owned: known.has(id) }))
    }
    if (tab === 'enemies' || tab === 'bosses') {
      const seen = new Set(save.seenEnemies)
      const bosses = tab === 'bosses'
      const gate = bosses ? ENEMIES.find((e) => e.gate) : undefined
      const out: { id: string; owned: boolean; group: string }[] = []
      for (const world of [1, 2] as const) {
        const group = world === 1 ? 'Mundo 1 · Noche de Hanabi' : 'Mundo 2 · Ceniza Carmesí'
        if (gate) out.push({ id: String(gate.type), owned: seen.has(gate.type), group })
        for (const e of ENEMIES) {
          if (e.boss !== bosses || e.world !== world) continue
          out.push({ id: String(e.type), owned: seen.has(e.type), group })
        }
      }
      return out
    }
    const skins = COSMETIC_ORDER.filter((id) => COSMETICS[id].kind === tab).map((id) => ({ id, owned: ownsCosmetic(save, id) }))
    if (tab === 'character_skin') {
      skins.sort((a, b) => {
        const ca = COSMETICS[a.id]
        const cb = COSMETICS[b.id]
        return CHARACTER_ORDER.indexOf((ca.characterId ?? '') as (typeof CHARACTER_ORDER)[number]) - CHARACTER_ORDER.indexOf((cb.characterId ?? '') as (typeof CHARACTER_ORDER)[number]) || RARITY_RANK[ca.rarity] - RARITY_RANK[cb.rarity]
      })
    } else if (tab === 'weapon_skin') {
      skins.sort((a, b) => {
        const ca = COSMETICS[a.id]
        const cb = COSMETICS[b.id]
        return WEAPON_ORDER.indexOf(ca.weaponId ?? '') - WEAPON_ORDER.indexOf(cb.weaponId ?? '') || RARITY_RANK[ca.rarity] - RARITY_RANK[cb.rarity]
      })
    }
    return skins
  }

  const renderGrid = (): void => {
    const list = items()
    if (!selected) selected = list[0]?.id ?? ''
    grid.replaceChildren()
    const unique = new Set(list.map((i) => i.id))
    const owned = new Set(list.filter((i) => i.owned).map((i) => i.id))
    const count = countLine(owned.size, unique.size)
    grid.append(el('div', 'album-count', count))
    const cards = el('div', 'album-cards')
    let lastFamily = ''
    for (const item of list) {
      const card = el('button', `album-card${item.id === selected ? ' selected' : ''}${item.owned ? '' : ' locked'}`)
      if (tab === 'characters') {
        const def = CHARACTERS[item.id]
        card.classList.add('hero')
        card.style.setProperty('--accent', def.palette.accent)
        const img = el('img', 'album-card-img') as HTMLImageElement
        img.src = item.owned ? portraitFor(app, item.id) : app.textures.portraits[item.id]
        img.draggable = false
        if (!item.owned) img.classList.add('silhouette')
        card.append(img, el('div', 'album-card-name', item.owned ? def.name : '???'))
      } else if (tab === 'weapons') {
        const def = WEAPONS[item.id]
        const family = weaponFamily(item.id)
        if (family !== lastFamily) {
          lastFamily = family
          cards.append(el('div', 'album-family', WEAPONS[family]?.name ?? family))
        }
        if (def.prestige) card.classList.add('prestige')
        if (def.evolution) card.classList.add('evolution')
        card.classList.add(weaponLootRarity(def))
        const ic = iconImg(def.icon, weaponIconFrame(def), 'album-weapon-icon')
        if (!item.owned) ic.classList.add('silhouette')
        card.append(ic, cardLabel(item.owned ? def.name : '???', maxWeaponLevel(def)))
      } else if (tab === 'passives') {
        const def = PASSIVES[item.id]
        card.classList.add('passive')
        const ic = iconImg(def.icon, 'passive', 'album-weapon-icon')
        if (!item.owned) ic.classList.add('silhouette')
        card.append(ic, cardLabel(item.owned ? def.name : '???', def.maxLevel))
      } else if (tab === 'enemies' || tab === 'bosses') {
        const def = ENEMIES[Number(item.id)]
        const family = item.group ?? (def.world === 2 ? 'Mundo 2 · Ceniza Carmesí' : 'Mundo 1 · Noche de Hanabi')
        if (family !== lastFamily) {
          lastFamily = family
          cards.append(el('div', 'album-family', family))
        }
        card.classList.add(enemyRarity(def), def.boss ? 'boss' : 'yokai')
        const img = el('img', 'album-card-img') as HTMLImageElement
        img.src = app.textures.enemyPortraits[def.type]
        img.draggable = false
        if (!item.owned) img.classList.add('silhouette')
        card.append(img, el('div', 'album-card-name', item.owned ? def.name : '???'))
      } else {
        const def = COSMETICS[item.id]
        if (tab === 'character_skin' || tab === 'weapon_skin') {
          const family = tab === 'character_skin' ? (def.characterId ?? '') : (def.weaponId ?? '')
          if (family !== lastFamily) {
            lastFamily = family
            const label = tab === 'character_skin' ? (CHARACTERS[family]?.name ?? family) : (WEAPONS[family]?.name ?? family)
            cards.append(el('div', 'album-family', label))
          }
        }
        card.classList.add(def.rarity)
        const img = cosmeticArt(app, def, 'album-card-img')
        if (!item.owned) img.classList.add('silhouette')
        card.append(img, el('div', 'album-card-name', item.owned ? def.name : '???'))
      }
      card.addEventListener('click', () => {
        app.sfx.ui()
        selected = item.id
        renderGrid()
        renderDetail()
      })
      cards.append(card)
    }
    grid.append(cards)
  }

  const renderDetail = (): void => {
    detail.replaceChildren()
    if (!selected) return
    if (tab === 'characters') {
      const def = CHARACTERS[selected]
      const unlocked = isUnlocked(app, selected)
      detail.style.setProperty('--accent', def.palette.accent)
      const img = el('img', 'album-portrait') as HTMLImageElement
      img.src = unlocked ? portraitFor(app, selected) : app.textures.portraits[selected]
      if (!unlocked) img.classList.add('silhouette')
      detail.append(
        img,
        el('div', 'detail-title', unlocked ? def.title : 'Sin descubrir'),
        el('div', 'detail-name', unlocked ? def.name : '???'),
        el('p', 'detail-desc', unlocked ? def.description : 'Completa partidas y gasta oro para desbloquear a esta heroína.')
      )
      return
    }
    if (tab === 'weapons') {
      const def = WEAPONS[selected]
      const known = save.unlockedWeapons.includes(selected)
      const loot = weaponLootRarity(def)
      const ic = iconImg(def.icon, weaponIconFrame(def), 'album-weapon-big')
      if (!known) ic.classList.add('silhouette')
      const tier = def.evolution
        ? 'Evolución'
        : def.prestige
          ? { common: 'Prestigio común', rare: 'Prestigio raro', epic: 'Prestigio épico', legendary: 'Prestigio legendario' }[loot]
          : 'Arma base'
      detail.append(
        ic,
        rarityBadge(loot),
        el('div', 'detail-title', known ? `${WEAPONS[weaponFamily(selected)]?.name ?? ''} · ${tier}` : 'Sin descubrir'),
        el('div', 'detail-name', known ? def.name : '???'),
        el('p', 'detail-desc', known ? def.description : 'Consigue esta arma durante una partida para revelarla.'),
        el('p', 'detail-desc', `Nivel máximo ${maxWeaponLevel(def)}`)
      )
      return
    }
    if (tab === 'passives') {
      const def = PASSIVES[selected]
      const known = save.unlockedPassives.includes(selected)
      const ic = iconImg(def.icon, 'passive', 'album-weapon-big')
      if (!known) ic.classList.add('silhouette')
      detail.append(
        ic,
        el('div', 'detail-title', known ? 'Pasiva' : 'Sin descubrir'),
        el('div', 'detail-name', known ? def.name : '???'),
        el('p', 'detail-desc', known ? def.description : 'Consigue esta pasiva durante una partida para revelarla.')
      )
      if (known) detail.append(el('p', 'detail-desc', `Por nivel: ${describeMods(def.perLevel)}`))
      detail.append(el('p', 'detail-desc', `Nivel máximo ${def.maxLevel}`))
      return
    }
    if (tab === 'enemies' || tab === 'bosses') {
      const def = ENEMIES[Number(selected)]
      const seen = save.seenEnemies.includes(def.type)
      const loot = enemyRarity(def)
      const img = el('img', 'album-portrait') as HTMLImageElement
      img.src = app.textures.enemyPortraits[def.type]
      if (!seen) img.classList.add('silhouette')
      detail.append(img, rarityBadge(loot))
      if (!seen) {
        detail.append(
          el('div', 'detail-title', 'Sin descubrir'),
          el('div', 'detail-name', '???'),
          el('p', 'detail-desc', 'Encuéntralo en una partida para revelarlo.')
        )
        return
      }
      detail.append(
        el('div', 'detail-title', `${def.gate ? 'Mundo 1 y 2' : def.world === 2 ? 'Mundo 2' : 'Mundo 1'} · ${def.boss ? 'Jefe' : 'Yokai'}`),
        el('div', 'detail-name', def.name),
        el('p', 'detail-desc', def.gate ? `${def.blurb} Aparece en el minuto 10 de cada mundo.` : def.blurb),
        el('p', 'detail-desc', `Vida ${def.hp} · velocidad ${def.speed} · daño ${def.damage} · experiencia ${def.xp}`)
      )
      return
    }
    const def = COSMETICS[selected]
    const owned = ownsCosmetic(save, def.id)
    const img = cosmeticArt(app, def, 'album-portrait')
    if (!owned) img.classList.add('silhouette')
    detail.append(img, rarityBadge(def), el('div', 'detail-title', KIND_LABEL[def.kind]), el('div', 'detail-name', owned ? def.name : '???'))
    detail.append(el('p', 'detail-desc', owned ? def.description : def.source === 'pass' ? 'Recompensa exclusiva del pase de batalla.' : 'Aparece en la tienda nocturna cuando rota el inventario.'))
    if (owned) {
      const equipped = isEquipped(save, def.id)
      const b = el('button', `btn primary${equipped ? '' : ''}`, equipped ? 'Quitar' : 'Equipar')
      b.addEventListener('click', () => {
        if (equipped) unequipCosmetic(save, def.id)
        else equipCosmetic(save, def.id)
        void app.persist()
        app.sfx.ui()
        renderGrid()
        renderDetail()
      })
      detail.append(b)
    } else {
      detail.append(el('div', 'album-locked-hint', def.source === 'pass' ? 'Exclusivo del pase premium' : `Precio en tienda: ${def.price.toLocaleString('es-ES')} oro`))
    }
  }

  renderTabs()
  renderGrid()
  renderDetail()
  return frame.root
}
