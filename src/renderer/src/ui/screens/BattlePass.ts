import type { App } from '@/App'
import { PASS_LEVELS, PASS_NAME, passLevel, xpIntoLevel, xpRequiredForNext } from '@/game/data/battlePass'
import { el } from '../dom'
import { screenFrame } from './common'

export function battlePass(app: App): HTMLElement {
  const save = app.save
  const frame = screenFrame('PASE DE BATALLA', `${PASS_NAME} · temporada ${save.battlePass.season}`, save.gold, () => app.mainMenu())

  const bp = save.battlePass
  const level = passLevel(bp.xp)
  const into = xpIntoLevel(bp.xp)
  const need = xpRequiredForNext(level)
  const done = level >= PASS_LEVELS

  const info = el('div', 'pass-info')
  const bar = el('div', 'pass-xp')
  const fill = el('div', 'pass-xp-fill')
  fill.style.transform = `scaleX(${done ? 1 : into / need})`
  bar.append(fill)
  info.append(
    el('div', 'pass-level', `Nivel ${level} / ${PASS_LEVELS}`),
    bar,
    el('div', 'pass-xp-label', done ? 'Pase al máximo' : `${into} / ${need} PE`)
  )

  const soon = el('div', 'coming-soon')
  soon.append(
    el('div', 'coming-soon-kicker', 'COMING SOON'),
    el('h2', 'coming-soon-title', 'Próximamente'),
    el('p', 'coming-soon-text', 'El pase sigue subiendo de nivel con cada partida. Las recompensas llegarán más adelante.')
  )

  frame.body.append(info, soon)
  return frame.root
}
