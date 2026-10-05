import { WEAPONS, type WeaponDef } from '../data/weapons'
import type { Player, WeaponSlot } from '../sim/Player'
import { ProjKind, ProjVisual, visualIndex } from '../sim/ProjectilePool'
import type { World } from '../sim/World'
import { areaDamage, damageEnemy, nearestEnemy, randomEnemyNear } from './combat'

export const AURA_BASE_RADIUS = 64
const SLASH_RX = 110
const SLASH_RY = 46
const ORBIT_BASE_RADIUS = 80
const STRIKE_BASE_RADIUS = 42
const ROCKET_BASE_AOE = 75
const TARGET_RANGE = 800

/** 0, +1, -1, +2, -2... so multi-shot volleys fan out symmetrically. */
function spreadIndex(shot: number): number {
  return shot === 0 ? 0 : (shot % 2 ? 1 : -1) * Math.ceil(shot / 2)
}

export function updateWeapons(world: World, dt: number): void {
  for (const p of world.players) {
    if (!p.alive) continue
    for (const w of p.weapons) {
      const def = WEAPONS[w.id]
      w.cooldown -= dt
      if (def.behavior === 'aura') {
        if (w.cooldown <= 0) {
          w.cooldown = w.stats.cooldown
          pulseAura(world, p, w, def)
          if (def.form === 'nova' && visualIndex(def.visual ?? -1) === ProjVisual.Petal) fireRing(world, p, w, def, true)
        }
        continue
      }
      if (w.cooldown <= 0 && w.burstLeft === 0) {
        w.cooldown = w.stats.cooldown
        if (def.behavior === 'orbit') {
          spawnOrbit(world, p, w, def)
          continue
        }
        w.burstLeft = Math.max(1, Math.round(w.stats.amount))
        w.burstTimer = 0
        w.shot = 0
      }
      while (w.burstLeft > 0 && w.burstTimer <= 0) {
        fire(world, p, w, def)
        w.shot++
        w.burstLeft--
        w.burstTimer += w.stats.interval
      }
      if (w.burstLeft > 0) w.burstTimer -= dt
    }
  }
}

function fire(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  if (def.form === 'fan') return fireFan(world, p, w, def)
  if (def.form === 'rain') return fireRain(world, p, w, def)
  if (def.form === 'ring' || def.form === 'nova') return fireRing(world, p, w, def, false)
  if (def.form === 'storm' && def.behavior === 'firework') return fireRocket(world, p, w, def)
  switch (def.behavior) {
    case 'slash':
      return fireSlash(world, p, w, def)
    case 'talisman':
      return fireTalisman(world, p, w, def)
    case 'kunai':
      return fireKunai(world, p, w)
    case 'lightning':
      return fireLightning(world, p, w, def)
    case 'boomerang':
      return fireBoomerang(world, p, w, def)
    case 'firework':
      return fireRocket(world, p, w, def)
    default:
      return
  }
}

function fireSlash(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const e = world.enemies
  const formed = def.form === 'cross' || def.form === 'petals'
  const row = Math.floor(w.shot / 2)
  let aimX = w.shot % 2 === 0 ? p.facing : -p.facing
  let aimY = 0
  if (formed) {
    const angle = (w.shot % 4) * (Math.PI / 2)
    aimX = Math.cos(angle)
    aimY = Math.sin(angle)
  }
  const dir = aimX >= 0 ? 1 : -1
  const rx = SLASH_RX * s.area
  const ry = SLASH_RY * s.area
  const cx = p.x + aimX * rx * 0.6
  const cy = p.y - 6 + aimY * rx * 0.45 + (formed ? 0 : (row % 2 === 0 ? -1 : 1) * Math.ceil(row / 2) * ry * 1.6)
  const buf = world.grid.result
  const n = world.grid.query(cx, cy, rx + world.maxEnemyRadius)
  for (let k = 0; k < n; k++) {
    const j = buf[k]
    if (!e.alive[j]) continue
    const er = e.radius[j]
    const nx = (e.x[j] - cx) / (rx + er)
    const ny = (e.y[j] - cy) / (ry + er)
    if (nx * nx + ny * ny > 1) continue
    damageEnemy(world, j, s.damage, aimX, aimY, s.knockback, p)
  }
  world.events.push({ e: 'slash', x: cx, y: cy, dir, rx, ry, evolved: !!def.evolution || def.form === 'petals', playerId: p.id })

  if (def.evolution || def.form === 'petals') {
    const glow = (def.visual ?? 0) >= 32
    const petals = glow ? 14 : def.form === 'petals' ? 8 : 6
    const offset = world.rng.next() * Math.PI
    for (let k = 0; k < petals; k++) {
      const a = offset + (k / petals) * Math.PI * 2
      const speed = 420 * s.speed
      world.projectiles.spawn({
        kind: ProjKind.Linear,
        visual: glow ? (def.visual ?? ProjVisual.Petal) : ProjVisual.Petal,
        owner: p.index,
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        damage: s.damage * 0.35,
        radius: 7 * s.area,
        life: 0.7,
        pierce: 3,
        knockback: 0.3
      })
    }
  }
}

function fireTalisman(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const t = nearestEnemy(world, p.x, p.y, TARGET_RANGE)
  const e = world.enemies
  let angle = t >= 0 ? Math.atan2(e.y[t] - p.y, e.x[t] - p.x) : Math.atan2(p.aimY, p.aimX)
  angle += spreadIndex(w.shot) * 0.12
  const speed = 380 * s.speed
  world.projectiles.spawn({
    kind: ProjKind.Linear,
    visual: def.evolution ? ProjVisual.Seal : ProjVisual.Talisman,
    owner: p.index,
    x: p.x,
    y: p.y - 4,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: s.damage,
    radius: (def.evolution ? 10 : 9) * s.area,
    life: s.duration,
    pierce: s.pierce,
    knockback: s.knockback
  })
}

function fireKunai(world: World, p: Player, w: WeaponSlot): void {
  const s = w.stats
  const spread = spreadIndex(w.shot)
  const angle = Math.atan2(p.aimY, p.aimX) + spread * 0.07
  const speed = 600 * s.speed
  world.projectiles.spawn({
    kind: ProjKind.Linear,
    visual: ProjVisual.Kunai,
    owner: p.index,
    x: p.x - p.aimY * spread * 6,
    y: p.y + p.aimX * spread * 6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: s.damage,
    radius: 7 * s.area,
    life: s.duration,
    pierce: s.pierce,
    knockback: s.knockback
  })
}

function spawnOrbit(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const count = Math.max(1, Math.round(s.amount))
  const base = (def.evolution ? 15 : 13) * Math.sqrt(s.area)
  for (let k = 0; k < count; k++) {
    world.projectiles.spawn({
      kind: ProjKind.Orbit,
      visual: def.evolution ? ProjVisual.SpiritFlame : ProjVisual.Foxfire,
      owner: p.index,
      x: p.x,
      y: p.y,
      damage: s.damage,
      radius: base,
      // Never outlive the cooldown, otherwise rings would stack.
      life: Math.min(s.duration, s.cooldown - 0.05),
      pierce: Number.POSITIVE_INFINITY,
      knockback: s.knockback,
      angle: (k / count) * Math.PI * 2,
      angSpeed: 3 * s.speed,
      orbitRadius: ORBIT_BASE_RADIUS * s.area,
      rehit: 0.5
    })
  }
}

function fireLightning(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const e = world.enemies
  const t = randomEnemyNear(world, p.x, p.y, 560)
  if (t < 0) return
  const radius = STRIKE_BASE_RADIUS * s.area
  let x = e.x[t]
  let y = e.y[t]
  const glow = (def.visual ?? 0) >= 32
  const chained = !!def.evolution || def.form === 'storm'
  const strikes = glow ? 4 : chained ? 3 : 1
  for (let k = 0; k < strikes; k++) {
    areaDamage(world, p, x, y, radius, s.damage, 0)
    world.events.push({ e: 'strike', x, y, radius, evolved: chained, playerId: p.id })
    const next = randomEnemyNear(world, x, y, 200)
    if (next < 0) break
    x = e.x[next]
    y = e.y[next]
  }
  if (glow) {
    const n = Math.max(1, Math.round(s.amount))
    const a = (w.shot / n) * Math.PI * 2
    const sx = p.x + Math.cos(a) * 150 * s.area
    const sy = p.y + Math.sin(a) * 150 * s.area
    areaDamage(world, p, sx, sy, radius * 0.85, s.damage * 0.7, 0)
    world.events.push({ e: 'strike', x: sx, y: sy, radius: radius * 0.85, evolved: true, playerId: p.id })
  }
}

function fireBoomerang(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const e = world.enemies
  const t = nearestEnemy(world, p.x, p.y, 600)
  let angle = t >= 0 ? Math.atan2(e.y[t] - p.y, e.x[t] - p.x) : Math.atan2(p.aimY, p.aimX)
  angle += spreadIndex(w.shot) * 0.35
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const speed = 460 * s.speed
  const decel = speed * 1.25
  world.projectiles.spawn({
    kind: ProjKind.Boomerang,
    visual: def.evolution ? ProjVisual.Fuuma : ProjVisual.Shuriken,
    owner: p.index,
    x: p.x,
    y: p.y,
    vx: dx * speed,
    vy: dy * speed,
    ax: -dx * decel,
    ay: -dy * decel,
    damage: s.damage,
    radius: 14 * s.area,
    life: s.duration,
    pierce: Number.POSITIVE_INFINITY,
    knockback: s.knockback,
    rehit: 0.4
  })
}

function fireRocket(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const e = world.enemies
  let t = randomEnemyNear(world, p.x, p.y, 520)
  if (t < 0) t = nearestEnemy(world, p.x, p.y, TARGET_RANGE)
  let angle = t >= 0 ? Math.atan2(e.y[t] - p.y, e.x[t] - p.x) : Math.atan2(p.aimY, p.aimX)
  angle += spreadIndex(w.shot) * 0.15
  const speed = 320 * s.speed
  world.projectiles.spawn({
    kind: ProjKind.Rocket,
    visual: def.visual ?? ProjVisual.Rocket,
    owner: p.index,
    x: p.x,
    y: p.y - 6,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: s.damage,
    radius: 10,
    life: s.duration,
    pierce: 1,
    knockback: s.knockback,
    aoe: ROCKET_BASE_AOE * s.area,
    cluster: !!def.evolution || !!def.cluster || def.form === 'storm'
  })
}

function fireFan(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const e = world.enemies
  const t = nearestEnemy(world, p.x, p.y, TARGET_RANGE)
  let angle = t >= 0 ? Math.atan2(e.y[t] - p.y, e.x[t] - p.x) : Math.atan2(p.aimY, p.aimX)
  const n = Math.max(1, Math.round(s.amount))
  angle += (n <= 1 ? 0 : w.shot / (n - 1) - 0.5) * 0.95
  const speed = (def.behavior === 'firework' ? 300 : def.behavior === 'kunai' ? 560 : 400) * s.speed
  if (def.behavior === 'firework') {
    fireRocketAt(world, p, w, def, p.x, p.y, Math.cos(angle) * speed, Math.sin(angle) * speed)
    return
  }
  world.projectiles.spawn({
    kind: ProjKind.Linear,
    visual: def.visual ?? (def.behavior === 'kunai' ? ProjVisual.Kunai : ProjVisual.Talisman),
    owner: p.index,
    x: p.x,
    y: p.y - 4,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage: s.damage,
    radius: 9 * s.area,
    life: Math.max(0.7, s.duration),
    pierce: s.pierce,
    knockback: s.knockback
  })
}

function fireRain(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const spread = spreadIndex(w.shot)
  const x = p.x + spread * 38
  const y = p.y - 250
  if (def.behavior === 'firework') {
    fireRocketAt(world, p, w, def, x, y, 0, 260 * s.speed)
    return
  }
  const visual = def.visual ?? ProjVisual.Talisman
  world.projectiles.spawn({
    kind: ProjKind.Linear,
    visual,
    owner: p.index,
    x,
    y,
    vx: 0,
    vy: 390 * s.speed,
    damage: s.damage,
    radius: 10 * s.area,
    life: Math.max(0.9, s.duration),
    pierce: s.pierce,
    knockback: s.knockback
  })
}

function fireRing(world: World, p: Player, w: WeaponSlot, def: WeaponDef, whole: boolean): void {
  const s = w.stats
  const n = Math.max(1, Math.round(s.amount))
  const nova = def.form === 'nova'
  const visual = def.visual ?? (nova ? ProjVisual.SpiritFlame : ProjVisual.Seal)
  const spawnOne = (angle: number): void => {
    if (def.behavior === 'firework') {
      fireRocketAt(world, p, w, def, p.x, p.y, Math.cos(angle) * 300 * s.speed, Math.sin(angle) * 300 * s.speed)
      return
    }
    const speed = (nova ? 230 : 470) * s.speed
    world.projectiles.spawn({
      kind: ProjKind.Linear,
      visual,
      owner: p.index,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: s.damage * (whole ? 0.45 : 1),
      radius: (nova ? 16 : 11) * s.area,
      life: nova ? 1.15 : Math.max(0.85, s.duration),
      pierce: s.pierce,
      knockback: s.knockback
    })
  }
  if (whole) {
    const spin = world.time * 0.7
    for (let k = 0; k < n; k++) spawnOne(spin + (k / n) * Math.PI * 2)
    return
  }
  spawnOne((w.shot / n) * Math.PI * 2 + world.time * 0.35)
}

function fireRocketAt(world: World, p: Player, w: WeaponSlot, def: WeaponDef, x: number, y: number, vx: number, vy: number): void {
  const s = w.stats
  world.projectiles.spawn({
    kind: ProjKind.Rocket,
    visual: def.visual ?? ProjVisual.Rocket,
    owner: p.index,
    x,
    y,
    vx,
    vy,
    damage: s.damage,
    radius: 10,
    life: s.duration,
    pierce: 1,
    knockback: s.knockback,
    aoe: ROCKET_BASE_AOE * s.area,
    cluster: !!def.evolution || !!def.cluster || def.form === 'storm'
  })
}

function pulseAura(world: World, p: Player, w: WeaponSlot, def: WeaponDef): void {
  const s = w.stats
  const hits = areaDamage(world, p, p.x, p.y, AURA_BASE_RADIUS * s.area, s.damage, s.knockback)
  if ((def.evolution || def.form === 'storm') && hits > 0) p.heal(Math.min(hits * (def.form === 'storm' ? 0.35 : 0.25), 4))
}
