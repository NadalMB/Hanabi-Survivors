import { accountLevel } from '@shared/account'
import type { App } from '@/App'
import {
  SKILL_BOARD,
  SKILL_HUB_ID,
  SKILL_NODES,
  SKILL_TREE_LAYOUT,
  migrateSkillTree,
  skillNode,
  skillPointsLeft,
  skillRankCost,
  skillRequirementText,
  skillTone,
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

const MIN_ZOOM = 0.55
const MAX_ZOOM = 1.85
const BOARD = SKILL_BOARD * 2

function gatherEdges(): Edge[] {
  const edges: Edge[] = []
  for (const def of SKILL_NODES) {
    for (const req of def.requires ?? []) edges.push({ from: req.id, to: def.id, kind: 'all' })
    for (const req of def.requiresAny ?? []) edges.push({ from: req.id, to: def.id, kind: 'any' })
  }
  return edges
}

function straightPath(a: Point, b: Point): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
}

export function skillTree(app: App, back: 'menu' | 'profile'): HTMLElement {
  const save = app.save
  migrateSkillTree(save.metaUpgrades)

  const frame = screenFrame(
    'ÁRBOL DE HABILIDADES',
    'Rueda para zoom · arrastra para mover · todo parte de Vitalidad.',
    save.gold,
    () => (back === 'profile' ? app.profile() : app.mainMenu())
  )

  const head = el('div', 'tree-head')
  const grove = el('div', 'skill-grove')
  const viewport = el('div', 'skill-grove-canvas')
  const world = el('div', 'skill-grove-world')
  const detail = el('aside', 'skill-detail')
  const zoomBar = el('div', 'skill-zoom-bar')
  viewport.append(world, zoomBar)
  grove.append(viewport, detail)
  frame.body.append(head, grove)

  let selected = SKILL_HUB_ID
  let zoom = 1
  let panX = 0
  let panY = 0
  let dragging = false
  let suppressClick = false
  let dragX = 0
  let dragY = 0
  let dragPanX = 0
  let dragPanY = 0
  let svgEl: SVGSVGElement | null = null
  let layerEl: HTMLElement | null = null

  const positions = new Map<string, Point>()
  for (const [id, pos] of Object.entries(SKILL_TREE_LAYOUT)) {
    positions.set(id, { x: pos.x + SKILL_BOARD, y: pos.y + SKILL_BOARD })
  }
  const edges = gatherEdges()

  const applyView = (): void => {
    const z = zoom
    const size = Math.round(BOARD * z)
    panX = Math.round(panX)
    panY = Math.round(panY)
    world.style.width = `${size}px`
    world.style.height = `${size}px`
    world.style.setProperty('--skill-zoom', String(z))
    world.style.transform = `translate(${panX}px, ${panY}px)`
    if (svgEl) {
      svgEl.setAttribute('width', String(size))
      svgEl.setAttribute('height', String(size))
    }
    if (layerEl) {
      layerEl.style.width = `${size}px`
      layerEl.style.height = `${size}px`
      for (const slot of layerEl.querySelectorAll<HTMLElement>('.skill-slot')) {
        const x = Number(slot.dataset.x)
        const y = Number(slot.dataset.y)
        slot.style.left = `${Math.round(x * z)}px`
        slot.style.top = `${Math.round(y * z)}px`
      }
    }
    const readout = zoomBar.querySelector('.skill-zoom-readout')
    if (readout) readout.textContent = `${Math.round(z * 100)}%`
  }

  const centerView = (): void => {
    const rect = viewport.getBoundingClientRect()
    panX = Math.round(rect.width / 2 - SKILL_BOARD * zoom)
    panY = Math.round(rect.height / 2 - SKILL_BOARD * zoom)
    applyView()
  }

  const setZoom = (next: number, aroundX?: number, aroundY?: number): void => {
    const rect = viewport.getBoundingClientRect()
    const ax = aroundX ?? rect.width / 2
    const ay = aroundY ?? rect.height / 2
    const worldX = (ax - panX) / zoom
    const worldY = (ay - panY) / zoom
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    panX = ax - worldX * zoom
    panY = ay - worldY * zoom
    applyView()
  }

  zoomBar.append(
    el('button', 'skill-zoom-btn', '−'),
    el('span', 'skill-zoom-readout', '100%'),
    el('button', 'skill-zoom-btn', '+'),
    el('button', 'skill-zoom-btn skill-zoom-reset', 'Centrar')
  )
  const [zoomOutBtn, , zoomInBtn, resetBtn] = zoomBar.children
  zoomOutBtn.addEventListener('click', () => {
    setZoom(zoom / 1.15)
    app.sfx.ui()
  })
  zoomInBtn.addEventListener('click', () => {
    setZoom(zoom * 1.15)
    app.sfx.ui()
  })
  resetBtn.addEventListener('click', () => {
    zoom = 1
    centerView()
    app.sfx.ui()
  })

  viewport.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault()
      const rect = viewport.getBoundingClientRect()
      setZoom(zoom * (ev.deltaY > 0 ? 1 / 1.1 : 1.1), ev.clientX - rect.left, ev.clientY - rect.top)
    },
    { passive: false }
  )

  viewport.addEventListener('pointerdown', (ev) => {
    if ((ev.target as HTMLElement).closest('.skill-node, .skill-zoom-bar')) return
    dragging = true
    suppressClick = false
    dragX = ev.clientX
    dragY = ev.clientY
    dragPanX = panX
    dragPanY = panY
    viewport.setPointerCapture(ev.pointerId)
    viewport.classList.add('panning')
  })
  viewport.addEventListener('pointermove', (ev) => {
    if (!dragging) return
    const dx = ev.clientX - dragX
    const dy = ev.clientY - dragY
    if (Math.hypot(dx, dy) > 4) suppressClick = true
    panX = Math.round(dragPanX + dx)
    panY = Math.round(dragPanY + dy)
    applyView()
  })
  const endDrag = (ev: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    viewport.classList.remove('panning')
    try {
      viewport.releasePointerCapture(ev.pointerId)
    } catch {
      /* already released */
    }
    // Clear after the click that follows a drag, so later upgrades still work.
    if (suppressClick) requestAnimationFrame(() => {
      suppressClick = false
    })
  }
  viewport.addEventListener('pointerup', endDrag)
  viewport.addEventListener('pointercancel', endDrag)

  const renderDetail = (def: SkillNodeDef): void => {
    const rank = Math.min(save.metaUpgrades[def.id] ?? 0, def.maxRank)
    const maxed = rank >= def.maxRank
    const lock = maxed ? null : skillRequirementText(save.metaUpgrades, def)
    const cost = maxed ? 0 : skillRankCost(def, rank)
    const points = skillPointsLeft(save)
    const hub = def.id === SKILL_HUB_ID
    detail.replaceChildren(
      el('div', 'skill-detail-kicker', hub ? 'Centro' : 'Mejora'),
      el('h2', 'skill-detail-name', def.name),
      iconImg(def.icon, 'meta', 'skill-detail-icon'),
      el('p', 'skill-detail-gain', describeMods(def.perRank)),
      el('p', 'skill-detail-rank', `${rank} / ${def.maxRank}`),
      el(
        'p',
        'skill-detail-note',
        maxed
          ? 'Al máximo.'
          : lock
            ? lock
            : hub && rank === 0
              ? `Abre las ramas · ${cost === 1 ? '1 punto' : `${cost} puntos`}`
              : points >= cost
                ? `Siguiente: ${cost === 1 ? '1 punto' : `${cost} puntos`}`
                : `Necesitas ${cost} puntos.`
      )
    )
  }

  const tryBuy = (def: SkillNodeDef): void => {
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
      return
    }
    save.metaUpgrades[def.id] = owned + 1
    void app.persist()
    app.sfx.coin()
    render()
  }

  const render = (): void => {
    migrateSkillTree(save.metaUpgrades)
    const points = skillPointsLeft(save)
    const level = accountLevel(save.accountXp)
    head.replaceChildren(
      el('div', 'tree-points', `${points.toLocaleString('es-ES')} ${points === 1 ? 'punto' : 'puntos'}`),
      el('div', 'tree-level', `Nivel ${level}`)
    )
    const reset = el('button', 'btn subtle', 'Reiniciar')
    reset.disabled = Object.keys(save.metaUpgrades).length === 0
    reset.addEventListener('click', () => {
      if (Object.keys(save.metaUpgrades).length === 0) return
      save.metaUpgrades = {}
      void app.persist()
      app.sfx.ui()
      render()
    })
    head.append(reset)

    const keepZoom = zoomBar
    world.replaceChildren()

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgEl = svg
    svg.setAttribute('class', 'skill-links')
    svg.setAttribute('viewBox', `0 0 ${BOARD} ${BOARD}`)
    svg.setAttribute('width', String(BOARD))
    svg.setAttribute('height', String(BOARD))

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
      path.setAttribute('d', straightPath(from, to))
      path.setAttribute(
        'class',
        `skill-link ${skillTone(edge.to)}${lit ? ' lit' : ''}${grown ? ' grown' : ''}${edge.kind === 'any' ? ' any' : ''}`
      )
      path.setAttribute('fill', 'none')
      path.setAttribute('vector-effect', 'non-scaling-stroke')
      svg.append(path)
    }
    world.append(svg)

    const layer = el('div', 'skill-nodes')
    layerEl = layer

    for (const def of SKILL_NODES) {
      const pos = positions.get(def.id)
      if (!pos) continue
      const rank = Math.min(save.metaUpgrades[def.id] ?? 0, def.maxRank)
      const maxed = rank >= def.maxRank
      const lock = maxed ? null : skillRequirementText(save.metaUpgrades, def)
      const cost = maxed ? 0 : skillRankCost(def, rank)
      const ready = !maxed && !lock && points >= cost
      const tone = skillTone(def.id)
      const hub = def.id === SKILL_HUB_ID
      const slot = el('div', `skill-slot${selected === def.id ? ' selected' : ''}${hub ? ' hub' : ''}`)
      slot.dataset.x = String(pos.x)
      slot.dataset.y = String(pos.y)

      const card = el(
        'button',
        `skill-node ${tone}${maxed ? ' maxed' : lock ? ' locked' : ready ? ' ready' : ' poor'}${rank > 0 ? ' trained' : ''}${hub ? ' hub' : ''}`
      )
      card.type = 'button'
      const ring = el('div', 'skill-ring')
      ring.append(iconImg(def.icon, 'meta', 'skill-icon'))
      if (!maxed && !lock) {
        const badge = el('span', 'skill-badge', cost === 0 ? '0' : String(cost))
        ring.append(badge)
      } else if (maxed) {
        ring.append(el('span', 'skill-badge max', '✓'))
      }
      const pips = el('div', 'pips')
      for (let i = 0; i < def.maxRank; i++) pips.append(el('span', `pip${i < rank ? ' on' : ''}`))
      card.append(ring, el('div', 'skill-name', def.name), pips)

      card.addEventListener('pointerenter', () => {
        selected = def.id
        renderDetail(def)
        for (const node of layer.querySelectorAll('.skill-slot')) node.classList.toggle('selected', node === slot)
      })
      card.addEventListener('click', (ev) => {
        if (suppressClick) {
          ev.preventDefault()
          suppressClick = false
          return
        }
        tryBuy(def)
      })
      slot.append(card)
      layer.append(slot)
    }
    world.append(layer)
    if (!keepZoom.isConnected) viewport.append(keepZoom)

    const focus = skillNode(selected) ?? SKILL_NODES[0]
    if (focus) renderDetail(focus)
    applyView()
  }

  render()
  requestAnimationFrame(() => centerView())
  return frame.root
}
