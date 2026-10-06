import { PASSIVES } from './data/passives'
import { maxWeaponLevel, WEAPONS } from './data/weapons'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from './sim/config'
import type { Player } from './sim/Player'

export interface PracticeSlot {
  id: string
  level: number
}

export interface PracticeLoadout {
  characterId: string
  weapons: PracticeSlot[]
  passives: PracticeSlot[]
}

/** Replace the starter build with the album practice loadout. */
export function applyPracticeLoadout(player: Player, loadout: PracticeLoadout): void {
  player.weapons.length = 0
  player.passives.length = 0
  for (const entry of loadout.weapons.slice(0, MAX_WEAPON_SLOTS)) {
    if (!WEAPONS[entry.id]) continue
    player.addWeapon(entry.id)
    const slot = player.weapons[player.weapons.length - 1]
    slot.level = Math.max(1, Math.min(maxWeaponLevel(WEAPONS[entry.id]), Math.round(entry.level)))
    player.refreshWeapon(slot)
  }
  for (const entry of loadout.passives.slice(0, MAX_PASSIVE_SLOTS)) {
    if (!PASSIVES[entry.id]) continue
    player.addPassive(entry.id)
    const slot = player.passives[player.passives.length - 1]
    slot.level = Math.max(1, Math.min(PASSIVES[entry.id].maxLevel, Math.round(entry.level)))
    slot.power = slot.level
  }
  if (player.weapons.length === 0) player.addWeapon(player.starterWeapon)
  player.recomputeStats()
  player.hp = player.stats.maxHp
  player.revivalsLeft = Math.round(player.stats.revival)
}
