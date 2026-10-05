import { accountLevel } from '@shared/account'
import type { App } from '@/App'
import {
  SKILL_BRANCHES,
  skillNode,
  skillPointsLeft,
  skillRankCost,
  skillRequirementText,
  type SkillNodeDef
} from '@/game/data/meta'
import { describeMods } from '@/game/data/stats'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { screenFrame } from './common'

export function skillTree(app: App, back: 'menu' | 'profile'): HTMLElement {
  const save = app.save
  const frame = screenFrame(
    'ÁRBOL DE HABILIDADES',
    'Cada nivel de perfil da un punto. Las ramas se abren en orden.',
    save.gold,
    () => (back === 'profile' ? app.profile() : app.mainMenu())
  )

  const head = el('div', 'tree-head')
  const board = el('div', 'skill-tree')
  frame.body.append(head, board)

  const render = (): void => {
    const points = skillPointsLeft(save)
    const level = accountLevel(save.accountXp)
    head.replaceChildren(
      el('div', 'tree-points', `${points.toLocaleString('es-ES')} ${points === 1 ? 'punto' : 'puntos'}`),
      el('div', 'tree-level', `Nivel de perfil ${level}`)
    )
    const reset = el('button', 'btn subtle', 'Reiniciar ramas')
    reset.disabled = Object.keys(save.metaUpgrades).length === 0
    reset.addEventListener('click', () => {
      if (Object.keys(save.metaUpgrades).length === 0) return
      save.metaUpgrades = {}
      void app.persist()
      app.sfx.ui()
      render()
    })
    head.append(reset)

    board.replaceChildren()
    for (const branch of SKILL_BRANCHES) {
      const col = el('section', `skill-branch ${branch.id}`)
      col.append(el('div', 'skill-kicker', branch.kicker), el('h2', 'skill-branch-name', branch.name), el('p', 'skill-branch-text', branch.text))
      const rows = el('div', 'skill-rows')
      branch.rows.forEach((ids, rowIndex) => {
        const row = el('div', `skill-row${rowIndex === 0 ? ' root' : ''}`)
        for (const id of ids) {
          const def = skillNode(id)
          if (def) row.append(nodeButton(def, points))
        }
        rows.append(row)
      })
      col.append(rows)
      board.append(col)
    }
  }

  const nodeButton = (def: SkillNodeDef, points: number): HTMLElement => {
    const rank = Math.min(save.metaUpgrades[def.id] ?? 0, def.maxRank)
    const maxed = rank >= def.maxRank
    const lock = maxed ? null : skillRequirementText(save.metaUpgrades, def)
    const cost = maxed ? 0 : skillRankCost(def, rank)
    const ready = !maxed && !lock && points >= cost
    const card = el('button', `skill-node${maxed ? ' maxed' : lock ? ' locked' : ready ? ' ready' : ' poor'}`)
    const pips = el('div', 'pips')
    for (let i = 0; i < def.maxRank; i++) pips.append(el('span', `pip${i < rank ? ' on' : ''}`))
    card.append(iconImg(def.icon, 'meta', 'skill-icon'), el('div', 'skill-name', def.name), el('div', 'skill-gain', describeMods(def.perRank)), pips)
    if (maxed) card.append(el('div', 'skill-cost', 'Máximo'))
    else if (lock) card.append(el('div', 'skill-cost', lock))
    else card.append(el('div', 'skill-cost', cost === 1 ? '1 punto' : `${cost} puntos`))
    card.addEventListener('click', () => {
      const owned = save.metaUpgrades[def.id] ?? 0
      if (owned >= def.maxRank || skillRequirementText(save.metaUpgrades, def)) {
        app.sfx.hurt()
        return
      }
      const price = skillRankCost(def, owned)
      if (skillPointsLeft(save) < price) {
        app.sfx.hurt()
        card.classList.remove('shake')
        void card.offsetWidth
        card.classList.add('shake')
        return
      }
      save.metaUpgrades[def.id] = owned + 1
      void app.persist()
      app.sfx.coin()
      render()
    })
    return card
  }

  render()
  return frame.root
}
