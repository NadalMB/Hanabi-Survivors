import type { App } from '@/App'
import { el } from '../dom'
import { screenFrame } from './common'

export function boutique(app: App): HTMLElement {
  const frame = screenFrame('TIENDA NOCTURNA', 'Skins, mascotas y adornos', app.save.gold, () => app.mainMenu())
  const soon = el('div', 'coming-soon')
  soon.append(
    el('div', 'coming-soon-kicker', 'COMING SOON'),
    el('h2', 'coming-soon-title', 'Próximamente'),
    el('p', 'coming-soon-text', 'La tienda está cerrada. Skins, mascotas, efectos y adornos volverán en una temporada próxima.')
  )
  frame.body.append(soon)
  return frame.root
}
