import { accountLevel } from '@shared/account'
import type { App } from '@/App'
import {
  SKILL_BRANCHES,
  SKILL_NODES,
  skillNode,
  skillPointsLeft,
  skillRankCost,
  skillRequirementText,
  type SkillBranch,
  type SkillNodeDef
} from '@/game/data/meta'
import { describeMods } from '@/game/data/stats'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { screenFrame } from './common'

interface Point {
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
  kind: 'all' | 'any'
}

/** Local 0–1 coords inside a branch column; root sits low so the tree grows upward. */
function layoutBranch(branch: SkillBranch): Map<string, Point> {
  const map = new Map<string, Point>()
  const rows = branch.rows
  rows.forEach((ids, rowIndex) => {
    const y = 0.9 - (rowIndex / Math.max(1, rows.length - 1 || 1)) * 0.72
    ids.forEach((id, colIndex) => {
      const x = ids.length === 1 ? 0.5 : (colIndex + 1) / (ids.length + 1)
      map.set(id, { x, y })
    })
  })
  return map
}

function gatherEdges(branchIds: ReadonlySet<string>): Edge[] {
  const edges: Edge[] = []
  for (const def of SKILL_NODES) {
    if (!branchIds.has(def.id)) continue
    for (const req of def.requires ?? []) {
      if (branchIds.has(req.id)) edges.push({ from: req.id, to: def.id, kind: 'all' })
    }
    for (const req of def.requiresAny ?? []) {
      edges.push({ from: req.id, to: def.id, kind: 'any' })
    }
  }
  return edges
}

function curvePath(a: Point, b: Point): string {
  const midY = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`
}

export function skillTree(app: App, back: 'menu' | 'profile'): HTMLElement {
  const save = app.save
  const frame = screenFrame(
    'ÁRBOL DE HABILIDADES',
    'Cada nivel de perfil da un punto. Mejora nodos para abrir los siguientes.',
    save.gold,
    () => (back === 'profile' ? app.profile() : app.mainMenu())
  )

  const head = el('div', 'tree-head')
  const grove = el('div', 'skill-grove')
  const canvas = el('div', 'skill-grove-canvas')
  const detail = el('aside', 'skill-detail')
  grove.append(canvas, detail)
  frame.body.append(head, grove)

  let selected = SKILL_BRANCHES[0]?.rows[0]?.[0] ?? 'filo'

  const branchLayouts = SKILL_BRANCHES.map((branch, index) => {
    const local = layoutBranch(branch)
    const global = new Map<string, Point>()
    const n = SKILL_BRANCHES.length
    for (const [id, pos] of local) {
      global.set(id, {
        x: (index + 0.12 + pos.x * 0.76) / n,
        y: pos.y
      })
    }
    return { branch, local, global }
  })

  const positions = new Map<string, Point>()
  for (const pack of branchLayouts) for (const [id, pos] of pack.global) positions.set(id, pos)

  const allIds = new Set(positions.keys())
  const edges = gatherEdges(allIds)

  const renderDetail = (def: SkillNodeDef): void => {
    const rank = Math.min(save.metaUpgrades[def.id] ?? 0, def.maxRank)
    const maxed = rank >= def.maxRank
    const lock = maxed ? null : skillRequirementText(save.metaUpgrades, def)
    const cost = maxed ? 0 : skillRankCost(def, rank)
    const points = skillPointsLeft(save)
    detail.replaceChildren(
      el('div', 'skill-detail-kicker', 'Nodo'),
      el('h2', 'skill-detail-name', def.name),
      iconImg(def.icon, 'meta', 'skill-detail-icon'),
      el('p', 'skill-detail-gain', describeMods(def.perRank)),
      el('p', 'skill-detail-rank', `Rango ${rank} / ${def.maxRank}`),
      el(
        'p',
        'skill-detail-note',
        maxed ? 'Al máximo.' : lock ? lock : points >= cost ? `Siguiente rango: ${cost === 1 ? '1 punto' : `${cost} puntos`}` : `Necesitas ${cost} puntos.`
      )
    )
  }

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

    canvas.replaceChildren()

    const labels = el('div', 'skill-branch-labels')
    for (const { branch } of branchLayouts) {
      const label = el('div', `skill-branch-label ${branch.id}`)
      label.append(el('div', 'skill-kicker', branch.kicker), el('div', 'skill-branch-name', branch.name))
      labels.append(label)
    }
    canvas.append(labels)

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'skill-links')
    svg.setAttribute('viewBox', '0 0 1000 1000')
    svg.setAttribute('preserveAspectRatio', 'none')
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    for (const tone of ['acero', 'santuario', 'viento', 'hanabi']) {
      const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
      grad.setAttribute('id', `link-${tone}`)
      grad.setAttribute('x1', '0%')
      grad.setAttribute('y1', '100%')
      grad.setAttribute('x2', '0%')
      grad.setAttribute('y2', '0%')
      const c1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
      const c2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
      c1.setAttribute('offset', '0%')
      c2.setAttribute('offset', '100%')
      if (tone === 'acero') {
        c1.setAttribute('stop-color', '#ff5fa2')
        c2.setAttribute('stop-color', '#ffb0d2')
      } else if (tone === 'santuario') {
        c1.setAttribute('stop-color', '#3dff78')
        c2.setAttribute('stop-color', '#9dffc0')
      } else if (tone === 'viento') {
        c1.setAttribute('stop-color', '#5fd3ff')
        c2.setAttribute('stop-color', '#bfefff')
      } else {
        c1.setAttribute('stop-color', '#ffd166')
        c2.setAttribute('stop-color', '#fff0b0')
      }
      grad.append(c1, c2)
      defs.append(grad)
    }
    svg.append(defs)

    const branchOf = (id: string): string => {
      for (const pack of branchLayouts) if (pack.global.has(id)) return pack.branch.id
      return 'hanabi'
    }

    for (const edge of edges) {
      const from = positions.get(edge.from)
      const to = positions.get(edge.to)
      if (!from || !to) continue
      const parentRank = save.metaUpgrades[edge.from] ?? 0
      const childDef = skillNode(edge.to)
      const need =
        childDef?.requires?.find((r) => r.id === edge.from)?.rank ??
        childDef?.requiresAny?.find((r) => r.id === edge.from)?.rank ??
        1
      const lit = parentRank >= need
      const grown = lit && (save.metaUpgrades[edge.to] ?? 0) > 0
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute(
        'd',
        curvePath({ x: from.x * 1000, y: from.y * 1000 }, { x: to.x * 1000, y: to.y * 1000 })
      )
      path.setAttribute(
        'class',
        `skill-link ${branchOf(edge.to)}${lit ? ' lit' : ''}${grown ? ' grown' : ''}${edge.kind === 'any' ? ' any' : ''}`
      )
      path.setAttribute('fill', 'none')
      svg.append(path)
    }
    canvas.append(svg)

    const layer = el('div', 'skill-nodes')
    for (const def of SKILL_NODES) {
      const pos = positions.get(def.id)
      if (!pos) continue
      const rank = Math.min(save.metaUpgrades[def.id] ?? 0, def.maxRank)
      const maxed = rank >= def.maxRank
      const lock = maxed ? null : skillRequirementText(save.metaUpgrades, def)
      const cost = maxed ? 0 : skillRankCost(def, rank)
      const ready = !maxed && !lock && points >= cost
      const tone = branchOf(def.id)
      const slot = el('div', `skill-slot${selected === def.id ? ' selected' : ''}`)
      slot.style.left = `${pos.x * 100}%`
      slot.style.top = `${pos.y * 100}%`

      const card = el(
        'button',
        `skill-node ${tone}${maxed ? ' maxed' : lock ? ' locked' : ready ? ' ready' : ' poor'}${rank > 0 ? ' trained' : ''}`
      )
      card.type = 'button'
      const ring = el('div', 'skill-ring')
      ring.append(iconImg(def.icon, 'meta', 'skill-icon'))
      const pips = el('div', 'pips')
      for (let i = 0; i < def.maxRank; i++) pips.append(el('span', `pip${i < rank ? ' on' : ''}`))
      card.append(ring, el('div', 'skill-name', def.name), pips)
      if (maxed) card.append(el('div', 'skill-cost', 'Máx'))
      else if (lock) card.append(el('div', 'skill-cost', 'Bloq.'))
      else card.append(el('div', 'skill-cost', `${cost}p`))

      card.addEventListener('mouseenter', () => {
        selected = def.id
        renderDetail(def)
        for (const node of layer.querySelectorAll('.skill-slot')) node.classList.toggle('selected', node === slot)
      })
      card.addEventListener('click', () => {
        selected = def.id
        renderDetail(def)
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
      slot.append(card)
      layer.append(slot)
    }
    canvas.append(layer)

    const focus = skillNode(selected) ?? SKILL_NODES[0]
    if (focus) renderDetail(focus)
  }

  render()
  return frame.root
}
