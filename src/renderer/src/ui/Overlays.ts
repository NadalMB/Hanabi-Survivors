import { ACCOUNT_LEVEL_CAP, accountXpProgress } from '@shared/account'
import { PASS_LEVELS, passLevel, xpIntoLevel, xpRequiredForNext } from '@/game/data/battlePass'
import { iconImg } from '@/render/icons'
import { el, formatTime } from './dom'
import { rarityOdds } from './RarityOdds'

export interface MenuAction {
  label: string
  hint?: string
  primary?: boolean
  run: () => void
}

export function actionRow(actions: MenuAction[]): HTMLElement {
  const row = el('div', 'actions')
  for (const a of actions) {
    const btn = el('button', `btn${a.primary ? ' primary' : ''}`, a.label)
    if (a.hint) btn.append(el('span', 'btn-hint', a.hint))
    btn.addEventListener('click', a.run)
    row.append(btn)
  }
  return row
}

function meter(kicker: string, tone: string): HTMLElement {
  const box = el('div', `pause-pass ${tone}`)
  box.append(el('div', 'pause-pass-kicker', kicker), el('div', 'pause-pass-level', ''), el('div', 'pass-xp'), el('div', 'pass-xp-label', ''))
  return box
}

function paintMeter(node: HTMLElement, levelText: string, ratio: number, label: string): void {
  const levelEl = node.querySelector('.pause-pass-level')
  const fill = node.querySelector('.pass-xp-fill') ?? el('div', 'pass-xp-fill')
  const bar = node.querySelector('.pass-xp')
  if (bar && !bar.querySelector('.pass-xp-fill')) bar.append(fill)
  if (fill instanceof HTMLElement) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`
  if (levelEl) levelEl.textContent = levelText
  const labelEl = node.querySelector('.pass-xp-label')
  if (labelEl) labelEl.textContent = label
}

export class PauseOverlay {
  private readonly root = el('div', 'overlay pause interactive')
  private fitNode: HTMLElement | null = null
  private passNode: HTMLElement | null = null
  private profileNode: HTMLElement | null = null
  private readonly onResize = (): void => this.refit()

  constructor(parent: HTMLElement) {
    parent.append(this.root)
    window.addEventListener('resize', this.onResize)
  }

  show(actions: MenuAction[], title = 'PAUSA', subtitle = '', luck = 1): void {
    const tracks = this.tracks()
    const nodes: HTMLElement[] = [el('div', 'pause-title', title), tracks]
    if (subtitle) nodes.push(el('div', 'gameover-sub', subtitle))
    if (actions.length) nodes.push(actionRow(actions))
    this.mount(nodes, luck)
  }

  showLoadout(board: HTMLElement, actions: MenuAction[], luck = 1): void {
    this.mount([el('div', 'pause-title compact', 'PAUSA'), this.tracks(), board, actionRow(actions)], luck)
  }

  showPanel(title: string, panel: HTMLElement, back: MenuAction, luck = 1): void {
    this.mount([el('div', 'pause-title compact', title), this.tracks(), panel, actionRow([back])], luck)
  }

  /** Saved pass XP plus what this run has earned so far. */
  setRunPass(savedXp: number, earned: number): void {
    const node = this.passNode
    if (!node || !this.root.classList.contains('visible')) return
    const total = savedXp + Math.max(0, earned)
    const level = passLevel(total)
    const into = xpIntoLevel(total)
    const need = xpRequiredForNext(Math.min(level, PASS_LEVELS - 1))
    const done = level >= PASS_LEVELS
    const run = `+${Math.floor(earned).toLocaleString('es-ES')} PE esta partida`
    paintMeter(node, `Nivel ${level} / ${PASS_LEVELS}`, done ? 1 : into / need, done ? `Pase completado · ${run}` : `${into} / ${need} PE · ${run}`)
  }

  /** Saved profile XP plus what this run has earned so far. */
  setRunProfile(savedXp: number, earned: number): void {
    const node = this.profileNode
    if (!node || !this.root.classList.contains('visible')) return
    const total = savedXp + Math.max(0, earned)
    const progress = accountXpProgress(total)
    const done = progress.level >= ACCOUNT_LEVEL_CAP
    const run = `+${Math.floor(earned).toLocaleString('es-ES')} XP esta partida`
    paintMeter(
      node,
      `Nivel ${progress.level} / ${ACCOUNT_LEVEL_CAP}`,
      done ? 1 : progress.into / progress.need,
      done ? `Perfil al máximo · ${run}` : `${progress.into} / ${progress.need} XP · ${run}`
    )
  }

  refit(): void {
    const inner = this.fitNode
    if (!inner || !this.root.classList.contains('visible')) return
    inner.style.zoom = '1'
    const style = getComputedStyle(this.root)
    const available = this.root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
    const needed = inner.offsetHeight
    const scale = needed > available + 1 && needed > 0 ? available / needed : 1
    inner.style.zoom = String(Math.min(1, scale))
  }

  hide(): void {
    this.passNode = null
    this.profileNode = null
    this.fitNode = null
    this.root.classList.remove('visible')
  }

  destroy(): void {
    window.removeEventListener('resize', this.onResize)
    this.root.remove()
  }

  private tracks(): HTMLElement {
    this.passNode = meter('Pase de batalla', 'battle')
    this.profileNode = meter('Perfil', 'profile')
    const row = el('div', 'pause-tracks')
    row.append(this.passNode, this.profileNode)
    return row
  }

  private mount(nodes: HTMLElement[], luck: number): void {
    this.fitNode = el('div', 'pause-fit')
    this.fitNode.append(...nodes)
    this.root.replaceChildren(this.fitNode, rarityOdds(luck))
    this.root.classList.add('visible')
    requestAnimationFrame(() => this.refit())
  }
}

export interface RunSummary {
  victory: boolean
  time: number
  kills: number
  level: number
  gold: number
  damage: number
  coop: boolean
  passXp?: number
  passLevels?: number
  accountXp?: number
  accountLevels?: number
  accountLevel?: number
}

export class GameOverOverlay {
  private readonly root = el('div', 'overlay gameover interactive')

  constructor(parent: HTMLElement) {
    parent.append(this.root)
  }

  show(summary: RunSummary, actions: MenuAction[]): void {
    const title = el('div', `gameover-title ${summary.victory ? 'victory' : 'defeat'}`, summary.victory ? '¡VICTORIA!' : summary.coop ? 'EQUIPO DERROTADO' : 'HAS CAÍDO')
    const sub = el('div', 'gameover-sub', summary.victory ? 'Sobrevivisteis a la noche de los yokai.' : 'La horda os ha superado... esta vez.')
    if (!summary.coop) sub.textContent = summary.victory ? 'Sobreviviste a la noche de los yokai.' : 'La horda te ha superado... esta vez.'
    const grid = el('div', 'summary')
    const stat = (label: string, value: string, cls = ''): HTMLElement => {
      const row = el('div', `summary-row ${cls}`)
      row.append(el('span', 'summary-label', label), el('span', 'summary-value', value))
      grid.append(row)
      return row
    }
    stat('Tiempo', formatTime(summary.time))
    stat('Nivel', String(summary.level))
    stat(summary.coop ? 'Enemigos derrotados (equipo)' : 'Enemigos derrotados', summary.kills.toLocaleString('es-ES'))
    stat('Tu daño total', Math.round(summary.damage).toLocaleString('es-ES'))
    const gold = stat('Oro obtenido', `+${summary.gold.toLocaleString('es-ES')}`, 'gold')
    gold.lastElementChild!.prepend(iconImg('coin', 'none', 'inline-icon'))
    if (summary.passXp) {
      const extra = summary.passLevels ? `  ·  +${summary.passLevels} nivel${summary.passLevels === 1 ? '' : 'es'}` : ''
      stat('Pase de batalla', `+${summary.passXp.toLocaleString('es-ES')} PE${extra}`)
    }
    if (summary.accountXp) {
      const extra = summary.accountLevels ? `  ·  nivel ${summary.accountLevel} (+${summary.accountLevels})` : ''
      stat('Perfil', `+${summary.accountXp.toLocaleString('es-ES')} XP${extra}`)
    }
    this.root.replaceChildren(title, sub, grid, actionRow(actions))
    this.root.classList.add('visible')
  }

  showMessage(title: string, message: string, actions: MenuAction[]): void {
    this.root.replaceChildren(el('div', 'gameover-title defeat', title), el('div', 'gameover-sub', message), actionRow(actions))
    this.root.classList.add('visible')
  }

  hide(): void {
    this.root.classList.remove('visible')
  }

  destroy(): void {
    this.root.remove()
  }
}
