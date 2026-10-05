import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS, resolveStarter, starterPair } from '@/game/data/characters'
import { describeMods } from '@/game/data/stats'
import { WEAPONS } from '@/game/data/weapons'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { portraitFor, screenFrame } from './common'

export function isUnlocked(app: App, id: string): boolean {
  return CHARACTERS[id].unlockCost === 0 || app.save.unlockedCharacters.includes(id)
}

export function characterSelect(app: App): HTMLElement {
  const save = app.save
  let selected = isUnlocked(app, save.lastCharacter) ? save.lastCharacter : 'sakura'
  const frame = screenFrame('ELIGE TU HEROÍNA', 'Elige una de sus dos armas comunes antes de empezar', save.gold, () => app.mainMenu())

  const layout = el('div', 'select-layout')
  const grid = el('div', 'char-grid')
  const detail = el('div', 'char-detail')
  layout.append(grid, detail)
  frame.body.append(layout)

  const renderGrid = (): void => {
    grid.replaceChildren()
    for (const id of CHARACTER_ORDER) {
      const def = CHARACTERS[id]
      const unlocked = isUnlocked(app, id)
      const card = el('button', `char-card${id === selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`)
      card.style.setProperty('--accent', def.palette.accent)
      const img = el('img', 'char-card-img') as HTMLImageElement
      img.src = unlocked ? portraitFor(app, id) : app.textures.portraits[id]
      img.draggable = false
      card.append(img, el('div', 'char-card-name', def.name))
      if (!unlocked) {
        const lock = el('div', 'char-lock')
        lock.append(iconImg('lock', 'none', 'char-lock-icon'), el('span', '', def.unlockCost.toLocaleString('es-ES')))
        card.append(lock)
      }
      card.addEventListener('click', () => {
        app.sfx.ui()
        selected = id
        renderGrid()
        renderDetail()
      })
      grid.append(card)
    }
  }

  const renderDetail = (): void => {
    const def = CHARACTERS[selected]
    const unlocked = isUnlocked(app, selected)
    const chosen = resolveStarter(selected, save.starterWeapons[selected])
    detail.style.setProperty('--accent', def.palette.accent)
    detail.replaceChildren()

    const art = el('div', 'detail-art')
    const img = el('img', 'detail-portrait') as HTMLImageElement
    img.src = unlocked ? portraitFor(app, selected) : app.textures.portraits[selected]
    img.draggable = false
    art.append(img)

    const info = el('div', 'detail-info')
    info.append(el('div', 'detail-title', def.title), el('div', 'detail-name', def.name), el('p', 'detail-desc', def.description))
    const weaponRow = el('div', 'starter-row')
    weaponRow.append(el('div', 'detail-weapon-label', 'Arma inicial'))
    for (const id of starterPair(selected)) {
      const weapon = WEAPONS[id]
      const card = el('button', `starter-card${id === chosen ? ' on' : ''}`)
      const text = el('div', 'detail-weapon-text')
      text.append(el('div', 'detail-weapon-name', weapon.name), el('div', 'detail-weapon-desc', weapon.description))
      card.append(iconImg(weapon.icon, 'weapon', 'detail-weapon-icon'), text)
      card.addEventListener('click', () => {
        if (!unlocked) return
        save.starterWeapons[selected] = id
        void app.persist()
        app.sfx.ui()
        renderDetail()
      })
      weaponRow.append(card)
    }
    info.append(weaponRow, el('div', 'detail-bonus', `Bonificación: ${describeMods(def.mods)}`))

    const actions = el('div', 'actions')
    if (unlocked) {
      const go = el('button', 'btn primary big', '¡A LUCHAR!')
      go.addEventListener('click', () => {
        save.lastCharacter = selected
        void app.persist()
        app.startSolo(selected, resolveStarter(selected, save.starterWeapons[selected]))
      })
      actions.append(go)
    } else {
      const canBuy = save.gold >= def.unlockCost
      const buy = el('button', `btn primary big${canBuy ? '' : ' disabled'}`, `Desbloquear · ${def.unlockCost.toLocaleString('es-ES')} oro`)
      buy.addEventListener('click', () => {
        if (save.gold < def.unlockCost) {
          app.sfx.hurt()
          return
        }
        save.gold -= def.unlockCost
        save.unlockedCharacters.push(selected)
        void app.persist()
        app.sfx.chest()
        frame.setGold(save.gold)
        renderGrid()
        renderDetail()
      })
      actions.append(buy)
    }
    info.append(actions)
    detail.append(art, info)
  }

  renderGrid()
  renderDetail()
  return frame.root
}
