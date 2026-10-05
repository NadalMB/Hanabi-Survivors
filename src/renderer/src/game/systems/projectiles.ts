import type { Player } from '../sim/Player'
import { ProjKind, ProjVisual } from '../sim/ProjectilePool'
import type { World } from '../sim/World'
import { areaDamage, damageEnemy } from './combat'

const CLUSTER_COUNT = 6

export function updateProjectiles(world: World, dt: number): void {
  const pr = world.projectiles
  const e = world.enemies
  const grid = world.grid
  const buf = grid.result
  const time = world.time

  // `pr.count` is re-read every iteration: cluster rockets append children mid-loop.
  for (let i = 0; i < pr.count; i++) {
    if (!pr.alive[i]) continue
    const owner = world.players[pr.owner[i]]
    const kind = pr.kind[i]

    pr.life[i] -= dt
    if (pr.life[i] <= 0) {
      if (kind === ProjKind.Rocket) explode(world, i, owner)
      pr.alive[i] = 0
      continue
    }

    if (kind === ProjKind.Orbit) {
      if (!owner.alive) {
        pr.alive[i] = 0
        continue
      }
      pr.angle[i] += pr.angSpeed[i] * dt
      pr.x[i] = owner.x + Math.cos(pr.angle[i]) * pr.orbitRadius[i]
      pr.y[i] = owner.y + Math.sin(pr.angle[i]) * pr.orbitRadius[i]
    } else {
      pr.vx[i] += pr.ax[i] * dt
      pr.vy[i] += pr.ay[i] * dt
      pr.x[i] += pr.vx[i] * dt
      pr.y[i] += pr.vy[i] * dt
    }

    const x = pr.x[i]
    const y = pr.y[i]
    const r = pr.radius[i]
    const n = grid.query(x, y, r + world.maxEnemyRadius)
    let detonate = false

    for (let k = 0; k < n; k++) {
      const j = buf[k]
      if (!e.alive[j]) continue
      const dx = e.x[j] - x
      const dy = e.y[j] - y
      const rr = r + e.radius[j]
      if (dx * dx + dy * dy > rr * rr) continue
      if (kind === ProjKind.Rocket) {
        // Explosion queries the grid too, so it must run after this loop.
        detonate = true
        break
      }
      if (!pr.canHit(i, e.id[j], time)) continue
      pr.recordHit(i, e.id[j], time)

      let kx: number
      let ky: number
      if (kind === ProjKind.Orbit) {
        const ox = e.x[j] - owner.x
        const oy = e.y[j] - owner.y
        const d = Math.hypot(ox, oy) || 1
        kx = ox / d
        ky = oy / d
      } else {
        const v = Math.hypot(pr.vx[i], pr.vy[i]) || 1
        kx = pr.vx[i] / v
        ky = pr.vy[i] / v
      }
      damageEnemy(world, j, pr.damage[i], kx, ky, pr.knockback[i], owner)

      pr.pierce[i] -= 1
      if (pr.pierce[i] <= 0) {
        pr.alive[i] = 0
        break
      }
    }

    if (detonate) {
      explode(world, i, owner)
      pr.alive[i] = 0
    }
  }
}

function explode(world: World, i: number, owner: Player): void {
  const pr = world.projectiles
  const x = pr.x[i]
  const y = pr.y[i]
  const radius = pr.aoe[i]
  areaDamage(world, owner, x, y, radius, pr.damage[i], pr.knockback[i])
  world.events.push({ e: 'explosion', x, y, radius, playerId: owner.id })
  if (!pr.cluster[i]) return

  const offset = world.rng.next() * Math.PI * 2
  for (let k = 0; k < CLUSTER_COUNT; k++) {
    const a = offset + (k / CLUSTER_COUNT) * Math.PI * 2
    pr.spawn({
      kind: ProjKind.Rocket,
      visual: ProjVisual.Rocket,
      owner: pr.owner[i],
      x,
      y,
      vx: Math.cos(a) * 260,
      vy: Math.sin(a) * 260,
      damage: pr.damage[i] * 0.5,
      radius: 8,
      life: 0.35,
      pierce: 1,
      knockback: pr.knockback[i] * 0.5,
      aoe: radius * 0.55
    })
  }
}
