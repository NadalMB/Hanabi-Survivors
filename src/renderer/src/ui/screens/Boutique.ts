import type { App } from '@/App'
import { COSMETICS, KIND_LABEL, equipCosmetic, isEquipped, ownsCosmetic } from '@/game/data/cosmetics'
import { dailyOffers, msUntilShopReset, shopDayKey } from '@/game/data/dailyShop'
import { formatCountdown, whileMounted } from '../dom'
import { el } from '../dom'
import { cosmeticArt, rarityBadge, screenFrame } from './common'

export function boutique(app: App): HTMLElement {
  const save = app.save
  const offers = dailyOffers()
  const frame = screenFrame('TIENDA NOCTURNA', `Rotación del ${shopDayKey()} · se renueva cada medianoche`, save.gold, () => app.mainMenu())

  const ticker = el('div', 'shop-ticker')
  const updateTicker = (): void => {
    ticker.textContent = `Nueva mercancía en ${formatCountdown(msUntilShopReset())}`
  }
  updateTicker()
  whileMounted(frame.root, updateTicker, 1000)

  const grid = el('div', 'boutique-grid')
  frame.body.append(ticker, grid)

  const render = (): void => {
    grid.replaceChildren()
    for (const offer of offers) {
      const def = COSMETICS[offer.id]
      if (!def) continue
      const owned = ownsCosmetic(save, def.id)
      const equipped = isEquipped(save, def.id)
      const card = el('article', `boutique-card ${def.rarity}${offer.featured ? ' featured' : ''}${owned ? ' owned' : ''}`)
      const art = el('div', 'boutique-art')
      const img = cosmeticArt(app, def)
      if (!owned && def.source === 'pass') img.classList.add('silhouette')
      art.append(img)
      if (offer.featured) art.append(el('div', 'featured-ribbon', 'Oferta del día −25%'))

      const body = el('div', 'boutique-body')
      body.append(
        rarityBadge(def),
        el('div', 'boutique-kind', KIND_LABEL[def.kind]),
        el('div', 'boutique-name', def.name),
        el('p', 'boutique-desc', def.description)
      )

      const action = el('button', 'btn primary boutique-buy')
      if (owned && equipped) {
        action.className = 'btn boutique-buy'
        action.textContent = 'Equipado'
        action.disabled = true
      } else if (owned) {
        action.textContent = 'Equipar'
        action.addEventListener('click', () => {
          equipCosmetic(save, def.id)
          void app.persist()
          app.sfx.ui()
          render()
        })
      } else if (save.gold < offer.price) {
        action.classList.add('poor')
        action.textContent = `${offer.price.toLocaleString('es-ES')} oro`
        action.addEventListener('click', () => {
          app.sfx.hurt()
          card.classList.remove('shake')
          void card.offsetWidth
          card.classList.add('shake')
        })
      } else {
        action.textContent = `Comprar · ${offer.price.toLocaleString('es-ES')}`
        action.addEventListener('click', () => {
          if (save.gold < offer.price) return
          save.gold -= offer.price
          save.ownedCosmetics.push(def.id)
          equipCosmetic(save, def.id)
          void app.persist()
          app.sfx.chest()
          frame.setGold(save.gold)
          render()
        })
      }
      body.append(action)
      card.append(art, body)
      grid.append(card)
    }
  }

  render()
  return frame.root
}
