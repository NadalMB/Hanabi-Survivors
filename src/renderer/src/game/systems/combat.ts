import { ENEMIES } from '../data/enemies'
import { PickupType } from '../sim/PickupPool'
import type { Player } from '../sim/Player'
import type { World } from '../sim/World'
import { spawnGem, spawnPickup } from './pickups'

const KNOCKBACK_FORCE = 260

export function damageEnemy(world: World, i: number, amount: number, kx: number, ky: number, knockback: number, owner: Player): void {
  const e = world.enemies
  if (!e.alive[i]) return
  const rng = world.rng
  const crit = rng.next() < owner.stats.critChance * owner.stats.luck
  const dmg = amount * (crit ? 2 : 1) * (0.9 + rng.next() * 0.2)
  e.hp[i] -= dmg
  e.flash[i] = 0.1
  owner.damageDealt += dmg
  if (knockback > 0) {
    const force = KNOCKBACK_FORCE * knockback * Math.max(0, 1 - e.kbResist[i])
    e.kbX[i] = kx * force
    e.kbY[i] = ky * force
  }
  world.events.push({ e: 'damage', x: e.x[i], y: e.y[i] - e.radius[i], amount: Math.max(1, Math.round(dmg)), crit })
  if (e.hp[i] <= 0) killEnemy(world, i, owner)
}

function killEnemy(world: World, i: number, owner: Player): void {
  const e = world.enemies
  const rng = world.rng
  e.alive[i] = 0
  world.kills++
  owner.kills++
  const x = e.x[i]
  const y = e.y[i]
  const def = ENEMIES[e.type[i]]
  const elite = e.elite[i] === 1
  const luck = owner.stats.luck

  spawnGem(world, x, y, e.xp[i])
  if (e.mini[i]) {
    dropChests(world, x, y)
    for (let k = 0; k < 3; k++) spawnPickup(world, PickupType.Gold, x, y, 3, 140)
  } else if (def.boss) {
    world.bossesDefeated++
    dropChests(world, x, y)
    for (let k = 0; k < 8; k++) spawnPickup(world, PickupType.Gold, x, y, 5, 160)
    if (def.gate) world.openPortal(x, y)
  } else if (elite) {
    dropChests(world, x, y)
  } else {
    const roll = rng.next()
    if (roll < 0.006 * luck) spawnPickup(world, PickupType.Heal, x, y, 30, 60)
    else if (roll < 0.03 * luck) spawnPickup(world, PickupType.Gold, x, y, 1 + rng.int(3), 60)
    else if (roll < 0.0315 * luck) spawnPickup(world, PickupType.Magnet, x, y, 0, 60)
  }
  world.events.push({ e: 'kill', x, y, enemyType: def.type, elite: elite || def.boss })
}

/** One chest. Whoever picks it up opens a different offer for every living player. */
function dropChests(world: World, x: number, y: number): void {
  spawnPickup(world, PickupType.Chest, x, y, 1, 0, 0)
}

/** Damages every enemy overlapping the circle; returns how many were hit. */
export function areaDamage(world: World, owner: Player, x: number, y: number, radius: number, damage: number, knockback: number): number {
  const e = world.enemies
  const buf = world.grid.result
  const n = world.grid.query(x, y, radius + world.maxEnemyRadius)
  let hits = 0
  for (let k = 0; k < n; k++) {
    const j = buf[k]
    if (!e.alive[j]) continue
    const dx = e.x[j] - x
    const dy = e.y[j] - y
    const rr = radius + e.radius[j]
    const d2 = dx * dx + dy * dy
    if (d2 > rr * rr) continue
    const d = Math.sqrt(d2) || 1
    damageEnemy(world, j, damage, dx / d, dy / d, knockback, owner)
    hits++
  }
  return hits
}

/**
 * Same as areaDamage, but damage falls off with distance from the center
 * (full at the impact point, about a quarter at the edge).
 */
export function areaDamageFalloff(
  world: World,
  owner: Player,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knockback: number
): number {
  const e = world.enemies
  const buf = world.grid.result
  const n = world.grid.query(x, y, radius + world.maxEnemyRadius)
  let hits = 0
  const reach = Math.max(1, radius)
  for (let k = 0; k < n; k++) {
    const j = buf[k]
    if (!e.alive[j]) continue
    const dx = e.x[j] - x
    const dy = e.y[j] - y
    const rr = radius + e.radius[j]
    const d2 = dx * dx + dy * dy
    if (d2 > rr * rr) continue
    const d = Math.sqrt(d2) || 1
    const falloff = 1 - Math.min(1, d / reach) * 0.75
    damageEnemy(world, j, damage * falloff, dx / d, dy / d, knockback, owner)
    hits++
  }
  return hits
}

export function nearestEnemy(world: World, x: number, y: number, maxDist: number, skip?: ReadonlySet<number>): number {
  const e = world.enemies
  let best = -1
  let bestD2 = maxDist * maxDist
  for (let i = 0; i < e.count; i++) {
    if (!e.alive[i] || skip?.has(i)) continue
    const dx = e.x[i] - x
    const dy = e.y[i] - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return best
}

/** Uniformly random alive enemy within range (reservoir sampling, single pass). */
export function randomEnemyNear(world: World, x: number, y: number, maxDist: number): number {
  const e = world.enemies
  const max2 = maxDist * maxDist
  let chosen = -1
  let seen = 0
  for (let i = 0; i < e.count; i++) {
    if (!e.alive[i]) continue
    const dx = e.x[i] - x
    const dy = e.y[i] - y
    if (dx * dx + dy * dy > max2) continue
    seen++
    if (world.rng.next() * seen < 1) chosen = i
  }
  return chosen
}
