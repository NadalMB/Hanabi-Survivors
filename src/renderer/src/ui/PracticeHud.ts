import { ENEMIES } from '@/game/data/enemies'
import { el } from './dom'

/** Floating panel used during a practice run to summon album enemies. */
export class PracticeHud {
  private readonly root = el('div', 'practice-hud interactive visible')
  private readonly list = el('div', 'practice-hud-list')
  private selected = 0

  constructor(
    parent: HTMLElement,
    private readonly onSpawn: (type: number, count: number) => void,
    private readonly onClear: () => void
  ) {
    const title = el('div', 'practice-hud-title', 'Práctica')
    const hint = el('p', 'practice-hud-hint', 'Elige un enemigo e invócalo. WASD para moverte.')
    this.root.append(title, hint, this.list)

    const actions = el('div', 'practice-hud-actions')
    const one = el('button', 'btn small', 'Invocar 1')
    const ten = el('button', 'btn small', 'Invocar 10')
    const clear = el('button', 'btn small', 'Limpiar')
    one.addEventListener('click', () => this.onSpawn(this.selected, 1))
    ten.addEventListener('click', () => this.onSpawn(this.selected, 10))
    clear.addEventListener('click', () => this.onClear())
    actions.append(one, ten, clear)
    this.root.append(actions)

    for (const def of ENEMIES) {
      const btn = el('button', `practice-hud-enemy${def.type === this.selected ? ' on' : ''}`, def.boss ? `★ ${def.name}` : def.name)
      btn.addEventListener('click', () => {
        this.selected = def.type
        for (const child of this.list.children) child.classList.toggle('on', child === btn)
      })
      this.list.append(btn)
    }
    parent.append(this.root)
  }

  destroy(): void {
    this.root.remove()
  }
}
