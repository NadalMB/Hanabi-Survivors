import type { App } from '@/App'
import { RARITY_COLOR, RARITY_LABEL, type CosmeticDef, type Rarity } from '@/game/data/cosmetics'
import { iconImg } from '@/render/icons'
import { el } from '../dom'

export function goldPill(amount: number): HTMLElement {
  const pill = el('div', 'gold-pill')
  pill.append(iconImg('coin', 'none', 'gold-pill-icon'), el('span', 'gold-pill-value', amount.toLocaleString('es-ES')))
  return pill
}

export interface ScreenFrame {
  root: HTMLElement
  body: HTMLElement
  setGold(amount: number): void
}

/** Standard menu screen: title bar with back button and gold counter. */
export function screenFrame(title: string, subtitle: string, gold: number, onBack: () => void): ScreenFrame {
  const root = el('div', 'screen interactive visible')
  const header = el('header', 'screen-header')
  const back = el('button', 'back-btn', '‹ Volver')
  back.addEventListener('click', onBack)
  const titles = el('div', 'screen-titles')
  titles.append(el('h1', 'screen-title', title), el('div', 'screen-subtitle', subtitle))
  let pill = goldPill(gold)
  header.append(back, titles, pill)
  const body = el('div', 'screen-body')
  root.append(header, body)
  return {
    root,
    body,
    setGold(amount: number) {
      const next = goldPill(amount)
      pill.replaceWith(next)
      pill = next
    }
  }
}

export function rarityBadge(rarity: Rarity | CosmeticDef): HTMLElement {
  const key = typeof rarity === 'string' ? rarity : rarity.rarity
  const badge = el('span', `rarity-badge ${key}`, RARITY_LABEL[key])
  badge.style.setProperty('--rarity', RARITY_COLOR[key])
  return badge
}

export function cosmeticArt(app: App, def: CosmeticDef, className = 'cosmetic-art'): HTMLImageElement {
  const img = el('img', className) as HTMLImageElement
  img.src = app.textures.previews[def.id] ?? app.textures.portraits[def.characterId ?? 'sakura']
  img.alt = def.name
  img.draggable = false
  return img
}

export function portraitFor(app: App, characterId: string): string {
  const skin = app.save.equipped.characterSkins[characterId]
  return app.textures.portraits[skin ?? characterId] ?? app.textures.portraits[characterId]
}

export function statusLine(): { node: HTMLElement; set(text: string, tone?: 'info' | 'error' | 'ok'): void } {
  const node = el('div', 'status-line')
  return {
    node,
    set(text, tone = 'info') {
      node.textContent = text
      node.className = `status-line ${tone}${text ? ' visible' : ''}`
    }
  }
}
