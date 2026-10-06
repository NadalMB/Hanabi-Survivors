import { EnemyType, ENEMIES } from '../data/enemies'
import { worldPower } from '../data/worlds'
import { enemyDamageScale, enemyHpScale } from '../data/waves'
import { EnemyMode } from '../sim/EnemyPool'
import type { World } from '../sim/World'
import { damagePlayer } from './players'

export interface Steer {
  mx: number
  my: number
  speed: number
}

type BossPattern = 'kitsune' | 'orochi' | 'raijin' | 'yuki' | 'oni'

function bossPattern(type: number): BossPattern {
  if (type === EnemyType.KitsuneBoss || type === EnemyType.Tamamo) return 'kitsune'
  if (type === EnemyType.OrochiBoss || type === EnemyType.Umibozu || type === EnemyType.GateAsh) return 'orochi'
  if (type === EnemyType.RaijinBoss || type === EnemyType.Raiju) return 'raijin'
  if (type === EnemyType.YukiBoss || type === EnemyType.Hannya) return 'yuki'
  return 'oni'
}

function periodFor(type: number): number {
  const pattern = bossPattern(type)
  if (pattern === 'kitsune') return 4.4
  if (pattern === 'orochi') return 6.8
  if (pattern === 'raijin') return 3.9
  if (pattern === 'yuki') return 5.0
  if (type === EnemyType.Gate) return 5.6
  if (type === EnemyType.GateAsh) return 6.4
  return 5.2
}

function lockAim(world: World, i: number, mx: number, my: number): void {
  const e = world.enemies
  if (e.dirX[i] !== 0 || e.dirY[i] !== 0) return
  const d = Math.hypot(mx, my) || 1
  e.dirX[i] = mx / d
  e.dirY[i] = my / d
}

function dash(world: World, i: number, speed: number): Steer {
  const e = world.enemies
  return { mx: e.dirX[i], my: e.dirY[i], speed }
}

function rayDistance(px: number, py: number, ox: number, oy: number, dx: number, dy: number, length: number): number {
  const vx = px - ox
  const vy = py - oy
  const proj = vx * dx + vy * dy
  if (proj < 0 || proj > length) return Infinity
  return Math.hypot(px - (ox + dx * proj), py - (oy + dy * proj))
}

function hurtNear(world: World, x: number, y: number, radius: number, damage: number): void {
  const r2 = radius * radius
  for (const p of world.players) {
    if (!p.alive) continue
    if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2) damagePlayer(world, p, damage)
  }
}

/** Persistent danger mark the renderer keeps on screen until `life` expires. */
function warn(
  world: World,
  x: number,
  y: number,
  radius: number,
  tint: number,
  life: number,
  x2?: number,
  y2?: number
): void {
  world.events.push({ e: 'telegraph', x, y, radius, tint, life, x2, y2 })
}

function bolt(world: World, x: number, y: number, radius: number, damage: number): void {
  world.events.push({ e: 'strike', x, y, radius, evolved: true, playerId: -1 })
  hurtNear(world, x, y, radius, damage)
}

/** Boss-specific steering. Also fires telegraphs, blinks and minion rings. */
export function steerBoss(world: World, i: number, mx: number, my: number): Steer {
  const e = world.enemies
  const type = e.type[i]
  const speed = e.speed[i]
  const t = e.timer[i]

  const pattern = bossPattern(type)
  let steer: Steer
  if (pattern === 'kitsune') steer = kitsune(world, i, t, mx, my, speed)
  else if (pattern === 'orochi') steer = orochi(world, i, t, mx, my, speed)
  else if (pattern === 'raijin') steer = raijin(world, i, t, mx, my, speed)
  else if (pattern === 'yuki') steer = yuki(world, i, t, mx, my, speed)
  else steer = oni(world, i, t, mx, my, speed)

  if (t <= 0) {
    const nearest = nearestAlive(world, e.x[i], e.y[i])
    e.timer[i] = periodFor(type)
    e.mark[i] = 0
    if (nearest && (pattern === 'kitsune' || pattern === 'yuki')) blinkPast(world, i, nearest.x, nearest.y, mx, my)
    if (pattern !== 'raijin') e.dirX[i] = e.dirY[i] = 0
  }
  return steer
}

function nearestAlive(world: World, x: number, y: number): { x: number; y: number } | undefined {
  let best: { x: number; y: number } | undefined
  let bestD = Infinity
  for (const p of world.players) {
    if (!p.alive) continue
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

function blinkPast(world: World, i: number, px: number, py: number, mx: number, my: number): void {
  const e = world.enemies
  const d = Math.hypot(mx, my) || 1
  e.x[i] = e.prevX[i] = px + (mx / d) * 220
  e.y[i] = e.prevY[i] = py + (my / d) * 220
  warn(world, e.x[i], e.y[i], 42, typeTint(e.type[i]), 0.55)
}

function typeTint(type: number): number {
  return ENEMIES[type]?.color ?? 0xffe08a
}

function oni(world: World, i: number, t: number, mx: number, my: number, speed: number): Steer {
  const e = world.enemies
  // Chase → long windup with marked charge lane + stomp circle → dash → stomp.
  if (t > 1.85) return { mx, my, speed }
  if (t > 0.95) {
    lockAim(world, i, mx, my)
    if (e.mark[i] === 0) {
      e.mark[i] = 1
      const life = t
      const dx = e.dirX[i]
      const dy = e.dirY[i]
      warn(world, e.x[i] + dx * 90, e.y[i] + dy * 90, 36, 0xff5a5a, life, e.x[i] + dx * 280, e.y[i] + dy * 280)
      warn(world, e.x[i] + dx * 200, e.y[i] + dy * 200, 48, 0xff7070, life)
      warn(world, e.x[i], e.y[i], 130, 0xff3b3b, life)
    }
    return { mx: 0, my: 0, speed: 0 }
  }
  if (t < 0.18 && e.mark[i] === 1) {
    e.mark[i] = 2
    warn(world, e.x[i], e.y[i], 130, 0xff3b3b, 0.25)
    hurtNear(world, e.x[i], e.y[i], 130, e.damage[i] * 1.3)
  }
  lockAim(world, i, mx, my)
  return dash(world, i, speed * 3.6)
}

function kitsune(world: World, i: number, t: number, mx: number, my: number, speed: number): Steer {
  const e = world.enemies
  if (t > 1.7) {
    const side = i % 2 === 0 ? 1 : -1
    const ox = mx * 0.25 - my * side
    const oy = my * 0.25 + mx * side
    const d = Math.hypot(ox, oy) || 1
    return { mx: ox / d, my: oy / d, speed: speed * 1.05 }
  }
  if (t > 0.95) {
    lockAim(world, i, mx, my)
    if (e.mark[i] === 0) {
      e.mark[i] = 1
      const life = t - 0.95 + 0.15
      const dx = e.dirX[i]
      const dy = e.dirY[i]
      warn(world, e.x[i] + dx * 70, e.y[i] + dy * 70, 34, 0xffe08a, life, e.x[i] + dx * 260, e.y[i] + dy * 260)
      warn(world, e.x[i] + dx * 160, e.y[i] + dy * 160, 42, 0xffc94a, life)
    }
    return { mx: 0, my: 0, speed: 0 }
  }
  lockAim(world, i, mx, my)
  return dash(world, i, speed * 3.2)
}

function orochi(world: World, i: number, t: number, mx: number, my: number, speed: number): Steer {
  const e = world.enemies
  if (t > 3.6) return { mx, my, speed: speed * 0.85 }
  if (t > 2.95) {
    lockAim(world, i, mx, my)
    if (e.mark[i] === 0) {
      e.mark[i] = 100
      warn(
        world,
        e.x[i] + e.dirX[i] * 100,
        e.y[i] + e.dirY[i] * 100,
        40,
        0x7dff9a,
        t - 2.95 + 0.2,
        e.x[i] + e.dirX[i] * 240,
        e.y[i] + e.dirY[i] * 240
      )
    }
    return { mx: 0, my: 0, speed: 0 }
  }
  if (t > 1.0) {
    const step = Math.floor((2.95 - t) / 0.7) + 1
    if (e.mark[i] !== step) {
      e.mark[i] = step
      e.dirX[i] = e.dirY[i] = 0
      lockAim(world, i, mx, my)
      const life = 0.55
      warn(
        world,
        e.x[i] + e.dirX[i] * 110,
        e.y[i] + e.dirY[i] * 110,
        38,
        0x7dff9a,
        life,
        e.x[i] + e.dirX[i] * 230,
        e.y[i] + e.dirY[i] * 230
      )
    }
    // Brief pause between snaps so the lane stays readable.
    const phase = (2.95 - t) % 0.7
    if (phase < 0.28) return { mx: 0, my: 0, speed: 0 }
    return dash(world, i, speed * 3.2)
  }
  if (e.mark[i] < 50) {
    e.mark[i] = 50
    const minutes = world.time / 60
    const surge = worldPower(world.realm) * world.pressure
    const minion = e.type[i] === EnemyType.Umibozu ? EnemyType.Onibi : EnemyType.Wisp
    warn(world, e.x[i], e.y[i], 170, 0x6fe8ff, 0.7)
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2
      const spawned = world.enemies.spawn(
        minion,
        e.x[i] + Math.cos(a) * 170,
        e.y[i] + Math.sin(a) * 170,
        enemyHpScale(minutes) * surge,
        enemyDamageScale(minutes) * surge,
        false,
        EnemyMode.Chase
      )
      if (spawned < 0) break
    }
  }
  const spin = i % 2 === 0 ? 1 : -1
  const ox = -my * spin
  const oy = mx * spin
  const d = Math.hypot(ox, oy) || 1
  return { mx: ox / d, my: oy / d, speed: speed * 0.45 }
}

function raijin(world: World, i: number, t: number, mx: number, my: number, speed: number): Steer {
  const e = world.enemies
  const nearest = nearestAlive(world, e.x[i], e.y[i])
  let radial = 0.1
  if (nearest) {
    const dist = Math.hypot(nearest.x - e.x[i], nearest.y - e.y[i])
    if (dist < 230) radial = -1
    else if (dist > 360) radial = 0.85
  }
  if (t <= 1.55 && e.mark[i] === 0 && nearest) {
    e.mark[i] = 1
    e.auxX[i] = nearest.x
    e.auxY[i] = nearest.y
    const a = Math.atan2(my, mx) + Math.PI / 2
    e.dirX[i] = nearest.x + Math.cos(a) * 140
    e.dirY[i] = nearest.y + Math.sin(a) * 140
    const life = Math.max(0.85, t - 0.28)
    warn(world, e.auxX[i], e.auxY[i], 78, 0xffe14a, life)
    warn(world, e.dirX[i], e.dirY[i], 78, 0xffe14a, life)
  }
  if (t <= 0.28 && e.mark[i] === 1) {
    e.mark[i] = 2
    bolt(world, e.auxX[i], e.auxY[i], 74, e.damage[i] * 1.6)
    bolt(world, e.dirX[i], e.dirY[i], 74, e.damage[i] * 1.6)
  }
  const side = i % 2 === 0 ? 1 : -1
  const sx = -my * side + mx * radial
  const sy = mx * side + my * radial
  const sl = Math.hypot(sx, sy) || 1
  const creeping = t < 1.55 && t > 0.28
  return { mx: sx / sl, my: sy / sl, speed: creeping ? speed * 0.3 : speed }
}

function yuki(world: World, i: number, t: number, mx: number, my: number, speed: number): Steer {
  const e = world.enemies
  for (const p of world.players) {
    if (!p.alive) continue
    if ((p.x - e.x[i]) ** 2 + (p.y - e.y[i]) ** 2 < 210 * 210) p.chill = 0.45
  }
  if (t > 1.9) return { mx, my, speed: speed * 0.9 }
  if (t > 0.55) {
    lockAim(world, i, mx, my)
    if (e.mark[i] === 0) {
      e.mark[i] = 1
      const base = Math.atan2(e.dirY[i] || my, e.dirX[i] || mx)
      const life = t - 0.55 + 0.1
      for (let k = 0; k < 8; k++) {
        const a = base + (k / 8) * Math.PI * 2
        const dx = Math.cos(a)
        const dy = Math.sin(a)
        warn(world, e.x[i] + dx * 160, e.y[i] + dy * 160, 28, 0xbfe9ff, life, e.x[i] + dx * 300, e.y[i] + dy * 300)
        for (const dist of [100, 190, 280]) {
          warn(world, e.x[i] + dx * dist, e.y[i] + dy * dist, 24, 0xbfe9ff, life)
        }
      }
    }
    return { mx: 0, my: 0, speed: 0 }
  }
  if (e.mark[i] === 1) {
    e.mark[i] = 2
    const base = Math.atan2(e.dirY[i] || my, e.dirX[i] || mx)
    for (let k = 0; k < 8; k++) {
      const a = base + (k / 8) * Math.PI * 2
      const dx = Math.cos(a)
      const dy = Math.sin(a)
      for (const p of world.players) {
        if (!p.alive) continue
        if (rayDistance(p.x, p.y, e.x[i], e.y[i], dx, dy, 320) < 28) damagePlayer(world, p, e.damage[i] * 1.4)
      }
    }
  }
  return { mx, my, speed: speed * 0.35 }
}
