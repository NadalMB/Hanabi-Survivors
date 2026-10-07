import { BATTLE_PASS_SEASON } from '@shared/save'
import type { SaveData } from '@shared/save'
import { COSMETICS, grantCosmetic } from './cosmetics'

export const PASS_NAME = 'Festival de las Linternas'
export const PASS_PREMIUM_COST = 12500
export const PASS_LEVELS = 100
/** Free-track index that grants the festival profile icon (needs pass level 10). */
export const PASS_AVATAR_LEVEL = 10
export const PASS_AVATAR_ID = 'avatar_festival'

/** XP required to leave `level` (0-based). Later tiers cost much more than the first. */
export function xpRequiredForNext(level: number): number {
  return 3200 + level * 280
}

export type PassReward = { type: 'gold'; amount: number } | { type: 'cosmetic'; id: string }

export interface PassTier {
  free?: PassReward
  premium?: PassReward
}

function emptyTier(): PassTier {
  return {}
}

/** Only the free level-10 profile icon for now. Premium track stays empty. */
export const PASS_TRACK: readonly PassTier[] = Array.from({ length: PASS_AVATAR_LEVEL }, (_, index) =>
  index === PASS_AVATAR_LEVEL - 1 ? { free: { type: 'cosmetic', id: PASS_AVATAR_ID } } : emptyTier()
)

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
    if (PASS_TRACK[i].premium && claimPassReward(save, i, 'premium')) n++
  }
  return n
}

export function rewardLabel(reward: PassReward): string {
  if (reward.type === 'gold') return `${reward.amount.toLocaleString('es-ES')} oro`
  return COSMETICS[reward.id]?.name ?? reward.id
}
