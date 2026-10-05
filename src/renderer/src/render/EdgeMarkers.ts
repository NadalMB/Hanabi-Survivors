/** Screen-edge pointers for teammates and chests that leave the view. */
export class EdgeMarkers {
  private readonly root: HTMLElement
  private readonly nodes: HTMLElement[] = []
  private used = 0
  private readonly placed: { x: number; y: number }[] = []

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'edge-markers'
    document.getElementById('ui')?.append(this.root)
  }

  begin(): void {
    this.used = 0
    this.placed.length = 0
  }

  /**
   * `sx`/`sy` are the target's screen position. On-screen targets are skipped so a
   * marker from a previous frame is released on the next `end()`.
   */
  mark(sx: number, sy: number, sw: number, sh: number, name: string, meters: number, color: string, icon = '', kind: '' | 'chest' | 'boss' | 'portal' = ''): void {
    const pad = 8
    if (sx >= pad && sx <= sw - pad && sy >= pad && sy <= sh - pad) return

    const margin = 28
    const dx = sx - sw / 2
    const dy = sy - sh / 2
    const hw = Math.max(8, sw / 2 - margin)
    const hh = Math.max(8, sh / 2 - margin)
    const scale = Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh, 1)

    let x = sw / 2 + dx / scale
    let y = sh / 2 + dy / scale
    for (const p of this.placed) {
      if ((p.x - x) ** 2 + (p.y - y) ** 2 > 34 * 34) continue
      if (Math.abs(dx) / hw > Math.abs(dy) / hh) y += y < sh / 2 ? -42 : 42
      else x += x < sw / 2 ? -42 : 42
    }
    x = Math.max(margin, Math.min(sw - margin, x))
    y = Math.max(margin, Math.min(sh - margin, y))
    this.placed.push({ x, y })

    let node = this.nodes[this.used]
    if (!node) {
      node = document.createElement('div')
      node.className = 'edge-marker'
      node.innerHTML = '<i class="edge-arrow"></i><img class="edge-icon" alt="" /><span class="edge-copy"><b></b><small></small></span>'
      this.root.append(node)
      this.nodes.push(node)
    }
    node.classList.toggle('chest', kind === 'chest' || (!kind && !!icon))
    node.classList.toggle('boss', kind === 'boss')
    node.classList.toggle('portal', kind === 'portal')
    node.style.display = 'flex'
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.color = color
    const arrow = node.querySelector('.edge-arrow') as HTMLElement
    arrow.style.transform = `rotate(${Math.atan2(dy, dx) + Math.PI / 2}rad)`
    const iconEl = node.querySelector('.edge-icon') as HTMLImageElement
    const nameEl = node.querySelector('b') as HTMLElement
    if (icon) {
      iconEl.src = icon
      iconEl.style.display = 'block'
      nameEl.style.display = 'none'
    } else {
      iconEl.style.display = 'none'
      nameEl.style.display = 'block'
      nameEl.textContent = name
    }
    const label = meters < 10 ? meters.toFixed(1) : String(Math.round(meters))
    ;(node.querySelector('small') as HTMLElement).textContent = `${label} m`
    this.used++
  }

  end(): void {
    for (let i = this.used; i < this.nodes.length; i++) this.nodes[i].style.display = 'none'
  }

  destroy(): void {
    this.root.remove()
  }
}
