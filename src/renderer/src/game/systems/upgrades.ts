import type { LootRarity, UpgradeChoice } from '@shared/protocol'
import { PASSIVES } from '../data/passives'
import { PRESTIGE_LABEL, prestigeOptions, rarityWeights, weaponFamily, type ChestRarity } from '../data/prestige'
import { designedMaxLevel, maxWeaponLevel, WEAPONS } from '../data/weapons'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '../sim/config'
import type { Player, WeaponSlot } from '../sim/Player'
import type { World } from '../sim/World'

export function upgradeName(choice: UpgradeChoice): string {
  if (choice.kind === 'prestige') return WEAPONS[choice.into ?? choice.id]?.name ?? choice.id
  if (choice.kind === 'weapon' || choice.kind === 'evolution') return WEAPONS[choice.id]?.name ?? choice.id
  if (choice.kind === 'passive') return PASSIVES[choice.id]?.name ?? choice.id
  return choice.kind === 'gold' ? 'Bolsa de oro' : 'Onigiri'
}

function tagged(choice: UpgradeChoice, rarity: LootRarity): UpgradeChoice {
  return { ...choice, rarity }
}

const UPGRADE_RARITIES: LootRarity[] = ['common', 'rare', 'epic', 'legendary']

const RARITY_NAMES: LootRarity[] = ['common', 'rare', 'epic', 'legendary']

function shares(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  return weights.map((weight) => weight / total)
}

/** Chance of each rarity for level-ups and chests at the player's current luck. */
export function rarityChances(luck: number): number[] {
  return shares(rarityWeights(luck))
}

export function rarityChanceLabel(index: number): string {
  return PRESTIGE_LABEL[RARITY_NAMES[index] ?? 'common']
}

function rollRarity(world: World, luck: number): LootRarity {
  const weights = rarityWeights(luck)
  const index = world.rng.weightedIndex(UPGRADE_RARITIES, (rarity) => weights[UPGRADE_RARITIES.indexOf(rarity)])
  return UPGRADE_RARITIES[Math.max(0, index)]
}

/** Levels granted by one card. A higher rarity climbs further along the same curve. */
export function raritySteps(rarity: LootRarity | undefined): number {
  if (rarity === 'legendary') return 4
  if (rarity === 'epic') return 3
  if (rarity === 'rare') return 2
  return 1
}

function rarityForSteps(steps: number): LootRarity {
  if (steps >= 4) return 'legendary'
  if (steps === 3) return 'epic'
  if (steps === 2) return 'rare'
  return 'common'
}

function ownedUpgrades(p: Player): UpgradeChoice[] {
  const list: UpgradeChoice[] = []
  for (const w of p.weapons) {
    if (w.level < maxWeaponLevel(WEAPONS[w.id])) list.push({ kind: 'weapon', id: w.id, level: w.level + 1 })
  }
  for (const ps of p.passives) {
    if (ps.level < PASSIVES[ps.id].maxLevel) list.push({ kind: 'passive', id: ps.id, level: ps.level + 1 })
  }
  return list
}

function isCommonWeapon(id: string): boolean {
  const def = WEAPONS[id]
  return !!def && !def.evolution && (!def.prestige || id.endsWith('_common'))
}

export function generateChoices(world: World, p: Player): UpgradeChoice[] {
  const pool = ownedUpgrades(p)

  if (p.weapons.length < MAX_WEAPON_SLOTS) {
    for (const def of Object.values(WEAPONS)) {
      if (!isCommonWeapon(def.id) || p.weapon(def.id)) continue
      pool.push({ kind: 'weapon', id: def.id, level: 1 })
    }
  }
  if (p.passives.length < MAX_PASSIVE_SLOTS) {
    for (const def of Object.values(PASSIVES)) {
      if (!p.passive(def.id)) pool.push({ kind: 'passive', id: def.id, level: 1 })
    }
  }

  const count = world.rng.next() < p.stats.luck - 1 ? 4 : 3
  const picks: UpgradeChoice[] = []
  // A level on a weapon you already own is deliberately uncommon.
  const weights = pool.map((c) => (c.kind === 'weapon' && c.level > 1 ? 0.32 : c.kind === 'passive' && c.level > 1 ? 1.1 : 1))
  while (picks.length < count && pool.length > 0) {
    const idx = world.rng.weightedIndex(weights, (w) => w)
    const choice = pool[idx]
    if ((choice.kind === 'weapon' || choice.kind === 'passive') && choice.level > 1) {
      const current = choice.level - 1
      const cap = choice.kind === 'weapon' ? maxWeaponLevel(WEAPONS[choice.id]) : PASSIVES[choice.id].maxLevel
      const room = cap - current
      const rolled = room <= 1 ? 'common' : rollRarity(world, p.stats.luck)
      const steps = Math.min(raritySteps(rolled), room)
      picks.push(tagged({ ...choice, level: current + steps }, rarityForSteps(steps)))
    } else picks.push(tagged(choice, 'common'))
    pool.splice(idx, 1)
    weights.splice(idx, 1)
  }
  return picks
}

export function applyChoice(world: World, p: Player, choice: UpgradeChoice): void {
  switch (choice.kind) {
    case 'weapon': {
      const slot = p.weapon(choice.id)
      if (!slot) {
        p.addWeapon(choice.id)
        world.events.push({ e: 'discover', playerId: p.id, weaponId: choice.id })
      } else {
        slot.level = Math.min(maxWeaponLevel(WEAPONS[choice.id]), choice.level)
        p.refreshWeapon(slot)
      }
      break
    }
    case 'prestige': {
      const slot = p.weapon(choice.id)
      const next = choice.into ? WEAPONS[choice.into] : undefined
      if (!slot || !next) break
      slot.id = next.id
      slot.cooldown = 0
      slot.burstLeft = 0
      slot.burstTimer = 0
      p.refreshWeapon(slot)
      world.events.push({ e: 'discover', playerId: p.id, weaponId: next.id })
      world.events.push({
        e: 'chest',
        playerId: p.id,
        lines: [`${PRESTIGE_LABEL[choice.rarity ?? 'rare']} · ${next.name}`]
      })
      break
    }
    case 'passive': {
      const slot = p.passive(choice.id)
      if (!slot) p.addPassive(choice.id)
      else if (slot.level < PASSIVES[choice.id].maxLevel) {
        slot.level = Math.min(PASSIVES[choice.id].maxLevel, choice.level)
        slot.power = slot.level
        p.recomputeStats()
      }
      break
    }
    case 'gold':
      world.gold += (choice.level || 25) * p.stats.greed
      break
    case 'heal':
      p.heal(30)
      break
    case 'evolution': {
      const slot = p.weapon(choice.id)
      const def = WEAPONS[choice.id]
      if (!slot || !def?.evolvesInto) break
      slot.id = def.evolvesInto
      slot.level = 1
      slot.cooldown = 0
      slot.burstLeft = 0
      p.refreshWeapon(slot)
      world.events.push({ e: 'discover', playerId: p.id, weaponId: slot.id })
      world.events.push({ e: 'evolution', playerId: p.id, weaponId: slot.id })
      break
    }
  }
}

function readyEvolution(p: Player): WeaponSlot | undefined {
  return p.weapons.find((slot) => {
    const def = WEAPONS[slot.id]
    return !!def.evolvesInto && !!def.evolvesWith && slot.level >= designedMaxLevel(def) && !!p.passive(def.evolvesWith)
  })
}

const CHEST_RARITIES: ChestRarity[] = ['common', 'rare', 'epic', 'legendary']

function rollChestRarity(world: World, luck: number): ChestRarity {
  return rollRarity(world, luck) as ChestRarity
}

function offerRarity(id: string): ChestRarity {
  if (id.endsWith('_legendary')) return 'legendary'
  if (id.endsWith('_epic')) return 'epic'
  if (id.endsWith('_rare')) return 'rare'
  return 'common'
}

/** Evolutions sit above every chest form, so a chest cannot trade one back down. */
function offerRank(id: string): number {
  if (WEAPONS[id]?.evolution) return CHEST_RARITIES.length
  return CHEST_RARITIES.indexOf(offerRarity(id))
}

/** Forms of this weapon that outrank the one already equipped. */
function betterOffers(slotId: string): { id: string; rarity: ChestRarity }[] {
  const floor = offerRank(slotId)
  return familyOffers(weaponFamily(slotId)).filter((offer) => CHEST_RARITIES.indexOf(offer.rarity) > floor)
}

/** Base weapon plus prestige forms. Evolutions stay out of this list. */
function familyOffers(family: string): { id: string; rarity: ChestRarity }[] {
  const offers: { id: string; rarity: ChestRarity }[] = []
  const base = WEAPONS[family]
  if (base && !base.prestige && !base.evolution) offers.push({ id: family, rarity: 'common' })
  for (const form of prestigeOptions(family)) offers.push({ id: form.id, rarity: offerRarity(form.id) })
  return offers
}

function blockChoice(blocked: Set<string>, choice: UpgradeChoice): void {
  if (choice.kind === 'prestige' && choice.into) blocked.add(choice.into)
  if (choice.kind === 'evolution') {
    const into = WEAPONS[choice.id]?.evolvesInto
    if (into) blocked.add(into)
  }
}

/** Nothing left to level or prestige: deliverChest pays consolation gold. */
function chestMiss(): UpgradeChoice {
  return { kind: 'gold', id: 'chest', level: 0, rarity: 'common' }
}

/** Levels on a carried weapon when the rolled prestige tier was not available. */
function chestLevelReward(world: World, p: Player, rarity: ChestRarity): UpgradeChoice {
  const roomy = p.weapons.filter((slot) => slot.level < maxWeaponLevel(WEAPONS[slot.id]))
  if (roomy.length === 0) return chestMiss()
  const slot = roomy[world.rng.int(roomy.length)]
  const steps = Math.min(raritySteps(rarity), maxWeaponLevel(WEAPONS[slot.id]) - slot.level)
  return { kind: 'weapon', id: slot.id, level: slot.level + steps, rarity: rarityForSteps(steps) }
}

/**
 * Chest prestige uses the rolled rarity as-is (72/20/6/2). No floor bump to the
 * next available form — if that tier is not open, the chest grants weapon levels
 * (or gold when every weapon is already capped).
 */
function rollPrestige(world: World, p: Player, blocked: Set<string>): UpgradeChoice {
  const owned = new Set(p.weapons.map((slot) => slot.id))
  const free = (id: string): boolean => !owned.has(id) && !blocked.has(id)
  const rarity = rollChestRarity(world, p.stats.luck)

  if (rarity === 'legendary') {
    const evo = readyEvolution(p)
    const into = evo ? WEAPONS[evo.id]?.evolvesInto : undefined
    if (evo && into && free(into)) {
      return { kind: 'evolution', id: evo.id, level: 1, rarity: 'legendary' }
    }
  }

  const matches: { slot: WeaponSlot; offer: { id: string; rarity: ChestRarity } }[] = []
  for (const slot of p.weapons) {
    for (const offer of betterOffers(slot.id)) {
      if (!free(offer.id) || offer.rarity !== rarity) continue
      matches.push({ slot, offer })
    }
  }
  if (matches.length === 0) return chestLevelReward(world, p, rarity)

  const fresh = matches.filter((m) => ![...blocked].some((id) => weaponFamily(id) === weaponFamily(m.slot.id)))
  const pool = fresh.length > 0 ? fresh : matches
  const pick = pool[world.rng.int(pool.length)]
  return { kind: 'prestige', id: pick.slot.id, into: pick.offer.id, level: pick.slot.level, rarity: pick.offer.rarity }
}

/** One chest reward. Prestige/evolution opens the UI; levels apply instantly. */
export function chestChoices(world: World, p: Player, blocked: Set<string> = new Set()): UpgradeChoice[] {
  const choice = rollPrestige(world, p, blocked)
  blockChoice(blocked, choice)
  return [choice]
}

/** True when the chest should open the prestige/evolution swap UI. */
export function isChestUiOffer(choice: UpgradeChoice | undefined): boolean {
  return !!choice && (choice.kind === 'prestige' || choice.kind === 'evolution')
}

/** Instant weapon levels from a chest (no overlay). */
export function isChestLevelOffer(choice: UpgradeChoice | undefined): boolean {
  return !!choice && choice.kind === 'weapon' && choice.level > 1
}

export const CHEST_CONSOLATION_GOLD = 10

/** One pickup opens a different chest for every living player. Solo still queues a personal chest. */
export function openChest(world: World, p: Player, x = p.x, y = p.y): void {
  const party = world.players.filter((pl) => pl.alive && !pl.disconnected)
  if (party.length <= 1) {
    p.pendingChests++
    p.pendingChestPos.push({ x, y })
    return
  }
  if (world.sharedChest) {
    world.queuedChests++
    world.queuedChestPos.push({ x, y })
    return
  }
  world.sharedChestOrigin = { x, y }
  world.sharedChest = rollSharedChest(world, party)
  for (const pl of party) pl.awaitingChest = true
}

/** Rolls a distinct offer per player. Later players avoid forms already dealt. */
export function rollSharedChest(world: World, party: readonly Player[]): { playerId: Player['id']; choices: UpgradeChoice[]; pick: number | null }[] {
  const blocked = new Set<string>()
  return party.map((pl) => ({ playerId: pl.id, choices: chestChoices(world, pl, blocked), pick: null }))
}
