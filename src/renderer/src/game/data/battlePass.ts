import { BATTLE_PASS_SEASON } from '@shared/save'
import type { SaveData } from '@shared/save'
import { COSMETICS, grantCosmetic } from './cosmetics'

export const PASS_NAME = 'Festival de las Linternas'
export const PASS_PREMIUM_COST = 10000
export const PASS_LEVELS = 100

/** XP required to leave `level` (0-based). Later tiers cost much more than the first. */
export function xpRequiredForNext(level: number): number {
  return 3200 + level * 280
}

export type PassReward = { type: 'gold'; amount: number } | { type: 'cosmetic'; id: string }

export interface PassTier {
  free?: PassReward
  premium: PassReward
}

const gold = (amount: number): PassReward => ({ type: 'gold', amount })
const item = (id: string): PassReward => ({ type: 'cosmetic', id })

/** Free track is modest; the flashy exclusives sit on the paid track. */
export const PASS_TRACK: readonly PassTier[] = [
  { free: gold(40), premium: item('will_wisp') },
  { free: gold(50), premium: gold(120) },
  { free: item('cherry_trail'), premium: item('halo') },
  { free: gold(60), premium: gold(140) },
  { premium: item('katana_crimson') },
  { free: gold(70), premium: item('horns') },
  { free: gold(80), premium: gold(160) },
  { premium: item('fox_kit') },
  { free: item('spark_burst'), premium: item('kunai_poison') },
  { premium: item('sakura_midnight') },
  { free: gold(90), premium: item('talisman_gold') },
  { free: gold(100), premium: gold(200) },
  { premium: item('fox_mask') },
  { free: item('snowfall'), premium: item('shuriken_ice') },
  { premium: item('rin_ocean') },
  { free: gold(110), premium: item('lantern_orb') },
  { free: gold(120), premium: gold(220) },
  { premium: item('kaede_moon') },
  { free: item('paper_chochin'), premium: item('foxfire_azure') },
  { premium: item('yuki_blossom') },
  { free: gold(140), premium: item('umbrella') },
  { free: gold(150), premium: item('hanabi_galaxy') },
  { premium: item('hikari_ivory') },
  { free: item('ember_wake'), premium: item('thunder_gold') },
  { premium: item('akane_jade') },
  { free: gold(160), premium: item('snow_owl') },
  { free: gold(180), premium: item('thunder_veil') },
  { premium: item('spirit_wings') },
  { free: gold(200), premium: item('moon_disk') },
  { premium: item('sakura_celestial') },
  { free: gold(220), premium: item('rin_shadowmiko') },
  { free: gold(240), premium: item('kaede_phantom') },
  { premium: item('yuki_aurora') },
  { free: gold(260), premium: item('hikari_raijin') },
  { premium: item('akane_empress') },
  { free: gold(280), premium: item('katana_phoenix') },
  { premium: item('talisman_divine') },
  { free: gold(300), premium: item('foxfire_ninefold') },
  { premium: item('star_dust') },
  { free: gold(400), premium: item('mini_dragon') },
  ...Array.from({ length: 60 }, (_, i): PassTier => {
    const level = 41 + i
    const freeGold = 80 + level * 4
    const premGold = 200 + level * 10
    return {
      free: level % 2 === 0 ? gold(freeGold) : undefined,
      premium: level % 10 === 0 ? gold(premGold * 2) : gold(premGold)
    }
  })
]

export function passLevel(xp: number): number {
  let level = 0
  let left = Math.max(0, xp)
  while (level < PASS_LEVELS) {
    const cost = xpRequiredForNext(level)
    if (left < cost) break
    left -= cost
    level++
  }
  return level
}

export function xpIntoLevel(xp: number): number {
  let level = 0
  let left = Math.max(0, xp)
  while (level < PASS_LEVELS) {
    const cost = xpRequiredForNext(level)
    if (left < cost) return left
    left -= cost
    level++
  }
  return xpRequiredForNext(PASS_LEVELS - 1)
}

/** XP already earned in the current run, before the victory bonus. */
export function battlePassXpSoFar(time: number, kills: number): number {
  const bosses = Math.max(0, Math.floor(time / 300))
  return Math.floor(time * 2.4) + Math.floor(kills * 1.2) + bosses * 70
}

export function battlePassXpForRun(info: { time: number; kills: number; victory: boolean; players: { kills: number }[] }, localKills: number): number {
  return battlePassXpSoFar(info.time, localKills) + (info.victory ? 240 : 0)
}

export function ensurePassSeason(save: SaveData): void {
  if (save.battlePass.season === BATTLE_PASS_SEASON) return
  save.battlePass = { season: BATTLE_PASS_SEASON, xp: 0, premium: false, claimedFree: [], claimedPremium: [] }
}

export function grantBattlePassXp(save: SaveData, amount: number): { gained: number; oldLevel: number; newLevel: number } {
  ensurePassSeason(save)
  const oldLevel = passLevel(save.battlePass.xp)
  save.battlePass.xp += Math.max(0, amount)
  return { gained: amount, oldLevel, newLevel: passLevel(save.battlePass.xp) }
}

export function canClaim(save: SaveData, index: number, track: 'free' | 'premium'): boolean {
  ensurePassSeason(save)
  if (passLevel(save.battlePass.xp) <= index) return false
  if (track === 'premium' && !save.battlePass.premium) return false
  const claimed = track === 'free' ? save.battlePass.claimedFree : save.battlePass.claimedPremium
  return !claimed.includes(index)
}

export function applyPassReward(save: SaveData, reward: PassReward): string {
  if (reward.type === 'gold') {
    save.gold += reward.amount
    return `+${reward.amount.toLocaleString('es-ES')} oro`
  }
  if (grantCosmetic(save, reward.id)) return COSMETICS[reward.id]?.name ?? reward.id
  save.gold += 150
  return `Ya lo tenías · +150 oro`
}

export function claimPassReward(save: SaveData, index: number, track: 'free' | 'premium'): string | null {
  const tier = PASS_TRACK[index]
  const reward = track === 'free' ? tier?.free : tier?.premium
  if (!reward || !canClaim(save, index, track)) return null
  const label = applyPassReward(save, reward)
  const claimed = track === 'free' ? save.battlePass.claimedFree : save.battlePass.claimedPremium
  claimed.push(index)
  return label
}

export function claimAllPassRewards(save: SaveData): number {
  let n = 0
  for (let i = 0; i < PASS_TRACK.length; i++) {
    if (PASS_TRACK[i].free && claimPassReward(save, i, 'free')) n++
    if (claimPassReward(save, i, 'premium')) n++
  }
  return n
}

export function rewardLabel(reward: PassReward): string {
  if (reward.type === 'gold') return `${reward.amount.toLocaleString('es-ES')} oro`
  return COSMETICS[reward.id]?.name ?? reward.id
}
