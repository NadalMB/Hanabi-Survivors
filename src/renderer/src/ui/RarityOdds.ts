import { rarityChanceLabel, rarityChances } from '@/game/systems/upgrades'
import { el } from './dom'

const TONE = ['common', 'rare', 'epic', 'legendary']

function percent(chance: number): string {
  const pct = chance * 100
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
}

/** Corner readout of the shared rarity odds for the player's current luck. */
export function rarityOdds(luck: number): HTMLElement {
  const panel = el('aside', 'rarity-odds')
  panel.append(el('div', 'rarity-odds-title', 'Probabilidades'))
  rarityChances(luck).forEach((chance, index) => {
    const row = el('div', `rarity-odds-row ${TONE[index] ?? 'common'}`)
    row.append(el('span', '', rarityChanceLabel(index)), el('b', '', percent(chance)))
    panel.append(row)
  })
  return panel
}
