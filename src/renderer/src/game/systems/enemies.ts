import { EnemyType, ENEMIES } from '../data/enemies'
import { DESPAWN_RADIUS, PLAYER_RADIUS, SPAWN_RADIUS } from '../sim/config'
import { EnemyMode } from '../sim/EnemyPool'
import type { World } from '../sim/World'
import { steerBoss } from './bosses'
import { damagePlayer } from './players'

const SEPARATION_SPEED = 90
const MAX_NEIGHBOURS = 12
const KNOCKBACK_DECAY = 9

export function updateEnemies(world: World, dt: number): void {
  const e = world.enemies
  const players = world.players
  const grid = world.grid
  const buf = grid.result
  const kbDecay = Math.exp(-KNOCKBACK_DECAY * dt)
  const queryPad = world.maxEnemyRadius
  let maxRadius = 0

  for (let i = 0; i < e.count; i++) {
    if (!e.alive[i]) continue
    const x = e.x[i]
    const y = e.y[i]
    const r = e.radius[i]
    if (r > maxRadius) maxRadius = r
    if (e.flash[i] > 0) e.flash[i] -= dt

    let target = -1
    let bestD2 = Infinity
    for (let p = 0; p < players.length; p++) {
      const pl = players[p]
      if (!pl.alive) continue
      const dx = pl.x - x
      const dy = pl.y - y
      const d2 = dx * dx + dy * dy
      if (d2 < bestD2) {
        bestD2 = d2
        target = p
      }
    }

    const mode = e.mode[i]
    let mx = 0
    let my = 0
    let speed = e.speed[i]

    if (mode === EnemyMode.Straight) {
      mx = e.dirX[i]
      my = e.dirY[i]
    } else if (target >= 0) {
      const d = Math.sqrt(bestD2) || 1
      mx = (players[target].x - x) / d
      my = (players[target].y - y) / d
    }

    if (mode === EnemyMode.Boss) {
      e.timer[i] -= dt
      const steered = steerBoss(world, i, mx, my)
      mx = steered.mx
      my = steered.my
      speed = steered.speed
    } else if (mode === EnemyMode.Leap) {
      const steered = steerLeap(e, i, dt, mx, my, e.type[i])
      mx = steered.mx
      my = steered.my
      speed = steered.speed
    } else if (mode === EnemyMode.Orbit) {
      const steered = steerOrbit(e, i, dt, mx, my)
      mx = steered.mx
      my = steered.my
      speed = steered.speed
    } else if (mode === EnemyMode.Weave) {
      const wobble = Math.sin(world.time * 4.5 + i * 1.7)
      const ox = mx - my * wobble * 1.15
      const oy = my + mx * wobble * 1.15
      const d = Math.hypot(ox, oy) || 1
      mx = ox / d
      my = oy / d
      speed *= 1.15
    }

    // Soft separation so hordes spread into a crowd instead of a single blob.
    let sx = 0
    let sy = 0
    const n = grid.query(x, y, r + queryPad)
    let neighbours = 0
    for (let k = 0; k < n && neighbours < MAX_NEIGHBOURS; k++) {
      const j = buf[k]
      if (j === i || !e.alive[j]) continue
      const dx = x - e.x[j]
      const dy = y - e.y[j]
      const min = r + e.radius[j]
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min) continue
      neighbours++
      if (d2 < 0.0001) {
        sx += i & 1 ? 1 : -1
        continue
      }
      const d = Math.sqrt(d2)
      const push = (min - d) / min
      sx += (dx / d) * push
      sy += (dy / d) * push
    }

    e.x[i] = x + (mx * speed + sx * SEPARATION_SPEED + e.kbX[i]) * dt
    e.y[i] = y + (my * speed + sy * SEPARATION_SPEED + e.kbY[i]) * dt
    e.kbX[i] *= kbDecay
    e.kbY[i] *= kbDecay

    if (target < 0) continue
    const pl = players[target]
    const touch = r + PLAYER_RADIUS
    if (bestD2 < touch * touch) damagePlayer(world, pl, e.damage[i])

    if (bestD2 > DESPAWN_RADIUS * DESPAWN_RADIUS && !ENEMIES[e.type[i]].boss) {
      if (mode === EnemyMode.Straight) {
        e.alive[i] = 0
        continue
      }
      // Recycle stragglers ahead of the player so density stays constant.
      const angle = Math.atan2(pl.aimY, pl.aimX) + world.rng.range(-1.1, 1.1)
      e.x[i] = e.prevX[i] = pl.x + Math.cos(angle) * SPAWN_RADIUS
      e.y[i] = e.prevY[i] = pl.y + Math.sin(angle) * SPAWN_RADIUS
    }
  }
  world.maxEnemyRadius = Math.max(16, maxRadius)
}

function steerLeap(
  e: World['enemies'],
  i: number,
  dt: number,
  mx: number,
  my: number,
  type: number
): { mx: number; my: number; speed: number } {
  const tengu = type === EnemyType.Tengu
  const period = tengu ? 1.9 : 1.15
  const wind = tengu ? 0.7 : 0.42
  const dash = tengu ? 0.32 : 0.18
  e.timer[i] -= dt
  if (e.timer[i] <= 0) {
    e.timer[i] = period
    e.dirX[i] = e.dirY[i] = 0
  }
  const speed = e.speed[i]
  const t = e.timer[i]
  if (t < dash) {
    if (e.dirX[i] === 0 && e.dirY[i] === 0) {
      const d = Math.hypot(mx, my) || 1
      e.dirX[i] = mx / d
      e.dirY[i] = my / d
    }
    return { mx: e.dirX[i], my: e.dirY[i], speed: speed * (tengu ? 4.6 : 3.4) }
  }
  if (t < wind) return { mx, my, speed: 0 }
  return { mx, my, speed: speed * 0.45 }
}

function steerOrbit(e: World['enemies'], i: number, dt: number, mx: number, my: number): { mx: number; my: number; speed: number } {
  e.timer[i] -= dt
  if (e.timer[i] <= 0) {
    e.timer[i] = 2.5
    e.dirX[i] = e.dirY[i] = 0
  }
  const side = i % 2 === 0 ? 1 : -1
  const speed = e.speed[i]
  const t = e.timer[i]
  if (t < 0.32) {
    if (e.dirX[i] === 0 && e.dirY[i] === 0) {
      const d = Math.hypot(mx, my) || 1
      e.dirX[i] = mx / d
      e.dirY[i] = my / d
    }
    return { mx: e.dirX[i], my: e.dirY[i], speed: speed * 3.5 }
  }
  if (t < 0.62) return { mx, my, speed: 0 }
  const ox = mx * 0.2 - my * side
  const oy = my * 0.2 + mx * side
  const d = Math.hypot(ox, oy) || 1
  return { mx: ox / d, my: oy / d, speed: speed * 1.05 }
}
