import type { MoveVector } from '@/core/Input'
import { PickupType } from './sim/PickupPool'
import type { Player } from './sim/Player'
import type { World } from './sim/World'

const DANGER_RADIUS = 220
const GREED_RADIUS = 260

/** Test bot: steers away from nearby enemies and toward gems, with a slow drift. */
export function autopilot(world: World, p: Player): MoveVector {
  const e = world.enemies
  let x = Math.cos(world.time * 0.2) * 0.3
  let y = Math.sin(world.time * 0.2) * 0.3

  for (let i = 0; i < e.count; i++) {
    const dx = p.x - e.x[i]
    const dy = p.y - e.y[i]
    const d2 = dx * dx + dy * dy
    if (d2 > DANGER_RADIUS * DANGER_RADIUS || d2 < 1) continue
    const w = (DANGER_RADIUS * DANGER_RADIUS) / d2 / 40
    const d = Math.sqrt(d2)
    x += (dx / d) * w
    y += (dy / d) * w
  }

  const pk = world.pickups
  let best = -1
  let bestD2 = GREED_RADIUS * GREED_RADIUS
  for (let i = 0; i < pk.count; i++) {
    if (pk.attracted[i] || pk.type[i] === PickupType.Magnet) continue
    const d2 = (pk.x[i] - p.x) ** 2 + (pk.y[i] - p.y) ** 2
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  if (best >= 0) {
    const d = Math.sqrt(bestD2) || 1
    x += ((pk.x[best] - p.x) / d) * 0.8
    y += ((pk.y[best] - p.y) / d) * 0.8
  }

  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}
