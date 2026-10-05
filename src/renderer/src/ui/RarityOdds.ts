import { chestRarityChances, levelRarityChances, rarityChanceLabel } from '@/game/systems/upgrades'
import { el } from './dom'

const TONE = ['common', 'rare', 'epic', 'legendary']

function percent(chance: number): string {
  return `${(chance * 100).toFixed(1)}%`
}

function column(title: string, chances: readonly number[]): HTMLElement {
  const block = el('div', 'rarity-odds-col')
  block.append(el('div', 'rarity-odds-kicker', title))
  chances.forEach((chance, index) => {
    const row = el('div', `rarity-odds-row ${TONE[index] ?? 'common'}`)
    row.append(el('span', '', rarityChanceLabel(index)), el('b', '', percent(chance)))
    block.append(row)
  })
  return block
}

/** Corner readout of chest and level-up rarity odds for the player's current luck. */
export function rarityOdds(luck: number): HTMLElement {
  const panel = el('aside', 'rarity-odds')
  panel.append(el('div', 'rarity-odds-title', 'Probabilidades'), column('Cofres', chestRarityChances(luck)), column('Niveles', levelRarityChances(luck)))
  return panel
}
