import { BASE_MAGNET_RADIUS, GEM_SOFT_CAP, PLAYER_RADIUS } from '../sim/config'
import { PickupType } from '../sim/PickupPool'
import type { Player } from '../sim/Player'
import type { World } from '../sim/World'
import { openChest } from './upgrades'

const PICKUP_DELAY = 0.25
const ATTRACT_ACCEL = 1400
const ATTRACT_BOUNCE = -160
const COLLECT_DISTANCE = PLAYER_RADIUS + 6
/** Gold, hearts and magnets fade so they cannot fill the pool and swallow chests. */
const LOOSE_LIFE = 36
const GEM_MERGE_RADIUS = 72

/** Display tiers. More XP makes the ofuda look more legendary. */
export function gemTier(value: number): number {
  if (value < 3) return 0
  if (value < 8) return 1
  if (value < 20) return 2
  if (value < 45) return 3
  return 4
}

export const GEM_DISPLAY = [1, 5, 12, 28, 70]

export function spawnPickup(world: World, type: number, x: number, y: number, value: number, popSpeed: number, owner = 0): void {
  const angle = world.rng.next() * Math.PI * 2
  const speed = popSpeed * (0.5 + world.rng.next() * 0.5)
  const pk = world.pickups
  if (type === PickupType.Chest || pk.count >= pk.capacity - 4) freePickupSlot(world)
  if (pk.spawn(type, x, y, value, Math.cos(angle) * speed, Math.sin(angle) * speed, owner) < 0) {
    freePickupSlot(world)
    pk.spawn(type, x, y, value, Math.cos(angle) * speed, Math.sin(angle) * speed, owner)
  }
}

/**
 * A talisman always appears on the corpse. Past the soft cap it grows a gem
 * already at that spot, or the farthest gem is moved there. XP is never dropped.
 */
export function spawnGem(world: World, x: number, y: number, value: number): void {
  const pk = world.pickups
  if (pk.count >= GEM_SOFT_CAP) {
    const near = nearestLooseGem(world, x, y, GEM_MERGE_RADIUS)
    if (near >= 0) {
      pk.value[near] += value
      return
    }
    const far = farthestGem(world, x, y)
    if (far >= 0) {
      pk.x[far] = pk.prevX[far] = x
      pk.y[far] = pk.prevY[far] = y
      pk.value[far] += value
      pk.age[far] = 0
      pk.attracted[far] = 0
      const angle = world.rng.next() * Math.PI * 2
      pk.vx[far] = Math.cos(angle) * 40
      pk.vy[far] = Math.sin(angle) * 40
      return
    }
  }
  const angle = world.rng.next() * Math.PI * 2
  const speed = 40 + world.rng.next() * 30
  if (pk.spawn(PickupType.Gem, x, y, value, Math.cos(angle) * speed, Math.sin(angle) * speed) < 0) {
    freePickupSlot(world)
    pk.spawn(PickupType.Gem, x, y, value, Math.cos(angle) * speed, Math.sin(angle) * speed)
  }
}

function nearestLooseGem(world: World, x: number, y: number, radius: number): number {
  const pk = world.pickups
  const r2 = radius * radius
  let best = -1
  let bestD = r2
  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i] || pk.type[i] !== PickupType.Gem || pk.attracted[i]) continue
    const dx = pk.x[i] - x
    const dy = pk.y[i] - y
    const d2 = dx * dx + dy * dy
    if (d2 <= bestD) {
      bestD = d2
      best = i
    }
  }
  return best
}

function farthestGem(world: World, x: number, y: number): number {
  const pk = world.pickups
  let best = -1
  let bestD = -1
  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i] || pk.type[i] !== PickupType.Gem || pk.attracted[i]) continue
    const dx = pk.x[i] - x
    const dy = pk.y[i] - y
    const d2 = dx * dx + dy * dy
    if (d2 > bestD) {
      bestD = d2
      best = i
    }
  }
  return best
}

/** Drops a coin, heart or loose gem so a chest or talisman can still spawn. */
function freePickupSlot(world: World): void {
  const pk = world.pickups
  if (pk.count < pk.capacity) return
  let victim = -1
  let rank = -1
  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i]) {
      victim = i
      break
    }
    if (pk.type[i] === PickupType.Chest || pk.type[i] === PickupType.Portal) continue
    const loose = pk.type[i] === PickupType.Gold || pk.type[i] === PickupType.Heal || pk.type[i] === PickupType.Magnet
    const score = loose ? 2 : pk.attracted[i] ? 0 : 1
    if (score > rank) {
      rank = score
      victim = i
    }
  }
  if (victim < 0) return
  pk.alive[victim] = 0
  pk.compact()
}

export function updatePickups(world: World, dt: number): void {
  const pk = world.pickups
  const players = world.players
  const drag = Math.exp(-6 * dt)

  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i]) continue
    pk.age[i] += dt

    if (pk.type[i] === PickupType.Portal) {
      pk.vx[i] *= drag
      pk.vy[i] *= drag
      pk.x[i] += pk.vx[i] * dt
      pk.y[i] += pk.vy[i] * dt
      if (pk.age[i] < PICKUP_DELAY) continue
      for (const p of players) {
        if (!p.alive) continue
        const dx = p.x - pk.x[i]
        const dy = p.y - pk.y[i]
        if (dx * dx + dy * dy < (PLAYER_RADIUS + 42) ** 2) {
          world.enterNext()
          pk.alive[i] = 0
          break
        }
      }
      continue
    }

    if (!pk.attracted[i] && pk.age[i] > LOOSE_LIFE && pk.type[i] !== PickupType.Gem && pk.type[i] !== PickupType.Chest) {
      pk.alive[i] = 0
      continue
    }

    if (!pk.attracted[i]) {
      pk.x[i] += pk.vx[i] * dt
      pk.y[i] += pk.vy[i] * dt
      pk.vx[i] *= drag
      pk.vy[i] *= drag
      if (pk.age[i] < PICKUP_DELAY) continue
      for (const p of players) {
        if (!p.alive) continue
        if (pk.owner[i] !== 0 && pk.owner[i] !== p.id) continue
        const radius = pk.type[i] === PickupType.Chest ? PLAYER_RADIUS + 18 : BASE_MAGNET_RADIUS * p.stats.magnet
        const dx = p.x - pk.x[i]
        const dy = p.y - pk.y[i]
        if (dx * dx + dy * dy < radius * radius) {
          pk.attracted[i] = 1
          pk.target[i] = p.index
          pk.speed[i] = ATTRACT_BOUNCE
          break
        }
      }
      continue
    }

    const p = players[pk.target[i]]
    if (!p.alive) {
      pk.attracted[i] = 0
      continue
    }
    pk.speed[i] += ATTRACT_ACCEL * dt
    const dx = p.x - pk.x[i]
    const dy = p.y - pk.y[i]
    const d = Math.hypot(dx, dy)
    if (d < COLLECT_DISTANCE) {
      if (collect(world, i, p)) pk.alive[i] = 0
      continue
    }
    const step = Math.min(pk.speed[i] * dt, d)
    pk.x[i] += (dx / d) * step
    pk.y[i] += (dy / d) * step
  }
}

function collect(world: World, i: number, p: Player): boolean {
  const pk = world.pickups
  const type = pk.type[i]
  switch (type) {
    case PickupType.Gem:
      world.addXp(pk.value[i] * p.stats.growth)
      break
    case PickupType.Heal:
      p.heal(pk.value[i])
      break
    case PickupType.Gold:
      if (!world.practice) world.gold += pk.value[i] * p.stats.greed
      break
    case PickupType.Chest:
      if (pk.owner[i] !== 0 && pk.owner[i] !== p.id) {
        pk.attracted[i] = 0
        return false
      }
      openChest(world, p, pk.x[i], pk.y[i])
      break
    case PickupType.Magnet:
      for (let k = 0; k < pk.count; k++) {
        if (pk.alive[k] && pk.type[k] === PickupType.Gem) {
          pk.attracted[k] = 1
          pk.target[k] = p.index
          pk.speed[k] = 0
        }
      }
      break
  }
  world.events.push({ e: 'pickup', kind: type, playerId: p.id, x: pk.x[i], y: pk.y[i] })
  return true
}
