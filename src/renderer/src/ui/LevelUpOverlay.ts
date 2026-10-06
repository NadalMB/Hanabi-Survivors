import type { ChestPeerView, LootRarity, UpgradeChoice } from '@shared/protocol'
import { PASSIVES } from '@/game/data/passives'
import { PRESTIGE_LABEL, type PrestigeRarity } from '@/game/data/prestige'
import { describeMods } from '@/game/data/stats'
import { describeWeaponLevelUp, describeWeaponSheet, WEAPONS, weaponIconFrame, type WeaponDef } from '@/game/data/weapons'
import { raritySteps, upgradeName } from '@/game/systems/upgrades'
import { iconImg, type IconFrame, type IconKey } from '@/render/icons'
import { el } from './dom'
import { rarityOdds } from './RarityOdds'

/** Ignore input briefly so a key held during gameplay doesn't pick a card by accident. */
const INPUT_GRACE_MS = 350

interface CardInfo {
  icon: IconKey
  frame: IconFrame
  tag: string
  text: string
  kind: string
  rarity: LootRarity
}

const FLIP_MS: Record<LootRarity, number> = { common: 520, rare: 820, epic: 1240, legendary: 1760 }
const CHEST_OPEN_MS = 780

const RARITY_RANK: Record<LootRarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

function bestRarity(choices: readonly UpgradeChoice[]): LootRarity {
  let best: LootRarity = 'common'
  for (const choice of choices) {
    const rarity = choice.rarity ?? 'common'
    if (RARITY_RANK[rarity] > RARITY_RANK[best]) best = rarity
  }
  return best
}

function describe(choice: UpgradeChoice): CardInfo {
  if (choice.kind === 'weapon') {
    const def = WEAPONS[choice.id]
    const rarity = choice.rarity ?? 'common'
    const fresh = choice.level === 1
    const evo = def.evolvesWith ? ` Evoluciona con ${PASSIVES[def.evolvesWith].name}.` : ''
    const steps = fresh ? 1 : raritySteps(rarity)
    const gain = fresh ? `${def.description}${evo} ${describeWeaponSheet(def.base)}` : `${steps > 1 ? `Sube ${steps} niveles. ` : ''}${describeWeaponLevelUp(def, choice.level, steps)}`
    const frame: IconFrame = !fresh && rarity !== 'common' ? rarity : weaponIconFrame(def)
    const tag = fresh ? '¡NUEVA!' : rarity === 'common' ? `Nv. ${choice.level}` : `${PRESTIGE_LABEL[rarity]} · Nv. ${choice.level}`
    return { icon: def.icon, frame, tag, text: gain, kind: fresh ? 'Arma' : 'Mejora', rarity }
  }
  if (choice.kind === 'prestige') {
    const from = WEAPONS[choice.id]
    const next = WEAPONS[choice.into ?? ''] ?? from
    const rarity = (choice.rarity ?? 'rare') as PrestigeRarity
    return {
      icon: next.icon,
      frame: rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' ? rarity : 'common',
      tag: PRESTIGE_LABEL[rarity],
      text: `${next.description} Sustituye a ${from.name} y conserva el nivel ${choice.level}.`,
      kind: 'Prestigio',
      rarity
    }
  }
  if (choice.kind === 'evolution') {
    const def = WEAPONS[choice.id]
    const into = WEAPONS[def.evolvesInto ?? '']
    return { icon: into?.icon ?? def.icon, frame: 'evolution', tag: 'EVOLUCIÓN', text: into?.description ?? def.description, kind: 'Evolución', rarity: 'legendary' }
  }
  if (choice.kind === 'passive') {
    const def = PASSIVES[choice.id]
    const rarity = choice.rarity ?? 'common'
    const fresh = choice.level === 1
    const steps = fresh ? 1 : raritySteps(rarity)
    const gain = `${steps > 1 ? `Sube ${steps} niveles. ` : ''}${describeMods(def.perLevel, steps)}`
    const frame: IconFrame = rarity === 'legendary' ? 'passive-legendary' : rarity === 'epic' ? 'passive-epic' : rarity === 'rare' ? 'passive-rare' : 'passive'
    const tag = fresh ? '¡NUEVA!' : rarity === 'common' ? `Nv. ${choice.level}` : `${PRESTIGE_LABEL[rarity]} · Nv. ${choice.level}`
    return {
      icon: def.icon,
      frame,
      tag,
      text: fresh ? `${def.description} ${gain}` : gain,
      kind: 'Pasiva',
      rarity
    }
  }
  if (choice.kind === 'gold') {
    const rarity = choice.rarity ?? 'common'
    return { icon: 'coin', frame: 'meta', tag: `+${choice.level || 25}`, text: 'Una bolsa llena de oro.', kind: 'Botín', rarity }
  }
  return { icon: 'onigiri', frame: 'meta', tag: '+30 PV', text: 'Recupera vida.', kind: 'Botín', rarity: 'common' }
}

export class LevelUpOverlay {
  private readonly root = el('div', 'overlay levelup interactive')
  private onPick: ((index: number) => void) | null = null
  private shownAt = 0
  private grace = INPUT_GRACE_MS
  private count = 0
  private chest = false
  private offerKey = ''
  private timers: number[] = []

  constructor(parent: HTMLElement) {
    parent.append(this.root)
    window.addEventListener('keydown', this.onKey)
  }

  destroy(): void {
    this.clearTimers()
    window.removeEventListener('keydown', this.onKey)
    this.root.remove()
  }

  get visible(): boolean {
    return this.onPick !== null
  }

  matches(choices: UpgradeChoice[]): boolean {
    return this.onPick !== null && this.offerKey === offerKey(choices)
  }

  show(choices: UpgradeChoice[], level: number, onPick: (index: number) => void, mode: 'level' | 'chest' = 'level', _peers: ChestPeerView[] = [], luck = 1): void {
    this.clearTimers()
    this.onPick = onPick
    this.shownAt = performance.now()
    this.count = choices.length
    this.chest = mode === 'chest'
    this.offerKey = offerKey(choices)
    this.grace = this.chest ? 99999 : INPUT_GRACE_MS
    const title = el('div', 'levelup-title')
    title.append(
      el('span', 'levelup-kicker', this.chest ? 'COFRE' : `NIVEL ${level}`),
      el('span', 'levelup-main', this.chest ? '¡COFRE!' : '¡SUBES DE NIVEL!')
    )
    const cardNodes: HTMLButtonElement[] = []
    const cards = el('div', this.chest ? 'chest-deals' : 'cards')
    let reject: HTMLButtonElement | null = null
    choices.forEach((choice, i) => {
      if (!this.chest) {
        const card = this.buildCard(choice, i, true)
        cards.append(card)
        cardNodes.push(card)
        return
      }
      const deal = this.chestDeal(choice, i, true)
      cards.append(deal.row)
      cardNodes.push(deal.next)
    })
    const nodes: HTMLElement[] = [title]
    let chestBox: HTMLElement | null = null
    if (this.chest) {
      chestBox = el('div', 'chest-reveal shut')
      chestBox.append(el('div', 'chest-lid'), el('div', 'chest-body'))
      nodes.unshift(chestBox)
      if (choices.some((choice) => choice.kind === 'prestige')) nodes.push(el('div', 'prestige-burst', 'PRESTIGIO'))
    }
    const hint = this.chest ? '1 o la nueva para aceptarla · 2 o la actual para rechazarla' : `Pulsa 1–${choices.length} o haz clic · 0 para rechazar`
    const foot = el('div', 'levelup-hint', hint)
    reject = el('button', this.chest ? 'chest-no locked' : 'chest-no', 'Rechazar')
    reject.type = 'button'
    reject.addEventListener('click', () => this.pick(-1))
    const actions = el('div', 'chest-actions')
    actions.append(reject)
    nodes.push(cards, actions, foot, rarityOdds(luck))
    const glow = !this.chest && bestRarity(choices) !== 'common' ? ` rarity-${bestRarity(choices)}` : ''
    this.root.className = `overlay levelup interactive visible ${this.chest ? 'chest' : ''}${glow}`
    this.root.replaceChildren(...nodes)
    if (!this.chest || !chestBox) return

    this.later(90, () => chestBox?.classList.add('open'))
    const cursor = this.scheduleFlips(cardNodes, choices, CHEST_OPEN_MS)
    this.later(cursor, () => {
      this.grace = 0
      this.shownAt = 0
      reject?.classList.remove('locked')
    })
  }

  /** Co-op keeps one chest on the ground, but each player only sees their own card. */
  setPeers(_peers: ChestPeerView[]): void {}

  hide(): void {
    this.clearTimers()
    this.onPick = null
    this.chest = false
    this.offerKey = ''
    this.root.className = 'overlay levelup interactive'
  }

  private chestDeal(choice: UpgradeChoice, index: number, mine: boolean): { row: HTMLElement; next: HTMLButtonElement; kept: HTMLButtonElement | null } {
    const next = this.buildCard(choice, index, mine)
    const from = replacedWeapon(choice)
    if (!from) return { row: next, next, kept: null }
    const kept = this.buildKept(from, choice, mine)
    const row = el('div', 'chest-swap')
    const left = el('div', 'chest-side')
    left.append(kept, el('span', 'chest-side-label', 'Ahora'))
    const right = el('div', 'chest-side')
    right.append(next, el('span', 'chest-side-label', 'Nueva'))
    row.append(left, el('div', 'chest-arrow', '→'), right)
    return { row, next, kept }
  }

  private buildKept(def: WeaponDef, choice: UpgradeChoice, mine: boolean): HTMLButtonElement {
    const frame = weaponIconFrame(def)
    const tone = frame === 'rare' || frame === 'epic' || frame === 'legendary' ? frame : frame === 'evolution' ? 'legendary' : 'common'
    const card = el('button', `card kept ${tone}`) as HTMLButtonElement
    card.type = 'button'
    const head = el('div', 'card-head')
    const tag = choice.kind === 'prestige' ? `Nv. ${choice.level}` : 'Equipada'
    head.append(el('span', 'card-kind', 'Ahora'), el('span', `card-tag ${tone}`, tag))
    const icon = el('div', 'card-icon')
    icon.append(iconImg(def.icon, weaponIconFrame(def), 'card-icon-img'))
    const front = el('div', 'card-front')
    const levelNote = choice.kind === 'prestige' ? `Nivel ${choice.level}. ` : ''
    front.append(head, icon, el('div', 'card-name', def.name), el('div', 'card-text', `${levelNote}Pulsa para conservarla.`))
    card.append(front)
    if (mine) card.addEventListener('click', () => this.pick(-1))
    return card
  }

  private buildCard(choice: UpgradeChoice, index: number, mine: boolean): HTMLButtonElement {
    const info = describe(choice)
    const card = el('button', this.chest ? `card ${choice.kind} sealed` : `card ${choice.kind} ${info.rarity}`) as HTMLButtonElement
    if (!this.chest && index >= 0) card.style.animationDelay = `${index * 90}ms`
    const head = el('div', 'card-head')
    if (mine && index >= 0) head.append(el('span', 'card-key', String(index + 1)))
    head.append(el('span', 'card-kind', info.kind), el('span', `card-tag ${info.rarity}`, info.tag))
    const icon = el('div', 'card-icon')
    icon.append(iconImg(info.icon, info.frame, 'card-icon-img'))
    const name = choice.kind === 'evolution' ? (WEAPONS[WEAPONS[choice.id]?.evolvesInto ?? '']?.name ?? upgradeName(choice)) : upgradeName(choice)
    const front = el('div', 'card-front')
    front.append(head, icon, el('div', 'card-name', name), el('div', 'card-text', info.text))
    if (this.chest) {
      const back = el('div', 'card-back')
      back.append(el('span', 'card-back-mark', '?'))
      card.append(back, front)
    } else card.append(front)
    if (mine && index >= 0) card.addEventListener('click', () => this.pick(index))
    return card
  }

  private scheduleFlips(cards: HTMLButtonElement[], choices: UpgradeChoice[], start: number): number {
    let cursor = start
    choices.forEach((choice, i) => {
      const rarity = choice.rarity ?? 'common'
      const flip = FLIP_MS[rarity]
      const dealAt = cursor
      const flipAt = dealAt + 280
      const revealAt = flipAt + flip * 0.52
      cursor = revealAt + 180
      const card = cards[i]
      this.later(dealAt, () => card.classList.add('dealt'))
      this.later(flipAt, () => {
        card.classList.add('flipping', `spin-${rarity}`)
        card.style.animationDuration = `${flip}ms`
      })
      this.later(revealAt, () => {
        card.classList.remove('sealed', 'flipping')
        card.style.animation = 'none'
        card.style.transform = ''
        card.classList.add('revealed', rarity)
        this.root.classList.remove('rarity-rare', 'rarity-epic', 'rarity-legendary')
        if (rarity !== 'common') this.root.classList.add(`rarity-${rarity}`)
      })
    })
    return cursor
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms))
  }

  private clearTimers(): void {
    for (const id of this.timers) window.clearTimeout(id)
    this.timers = []
  }

  private pick(index: number): void {
    if (!this.onPick || performance.now() - this.shownAt < this.grace) return
    if (index >= this.count) return
    const cb = this.onPick
    this.hide()
    cb(index)
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.onPick) return
    if ((this.chest && this.count < 2 && e.key === '2') || (!this.chest && e.key === '0')) {
      this.pick(-1)
      return
    }
    const n = Number(e.key)
    if (n >= 1 && n <= this.count) this.pick(n - 1)
  }
}

function replacedWeapon(choice: UpgradeChoice): WeaponDef | undefined {
  if (choice.kind !== 'prestige' && choice.kind !== 'evolution') return undefined
  return WEAPONS[choice.id]
}

function offerKey(choices: readonly UpgradeChoice[]): string {
  return choices.map((c) => `${c.kind}/${c.id}/${c.into ?? ''}/${c.rarity ?? ''}`).join(',')
}

