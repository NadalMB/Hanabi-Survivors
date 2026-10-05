import { PLAYER_BASE_SPEED, PLAYER_IFRAMES } from '../sim/config'
import { CHILL_SPEED, type Player } from '../sim/Player'
import type { World } from '../sim/World'

export const REVIVE_RADIUS = 56
export const REVIVE_SECONDS = 3

export function updatePlayers(world: World, dt: number): void {
  for (const p of world.players) {
    if (!p.alive) {
      if (world.players.length > 1 && !p.disconnected) tickRevive(world, p, dt)
      continue
    }
    const chilled = p.chill > 0
    p.chill = Math.max(0, p.chill - dt)
    const speed = PLAYER_BASE_SPEED * p.stats.moveSpeed * (chilled ? CHILL_SPEED : 1)
    p.x += p.moveX * speed * dt
    p.y += p.moveY * speed * dt
    const len = Math.hypot(p.moveX, p.moveY)
    if (len > 0.1) {
      p.aimX = p.moveX / len
      p.aimY = p.moveY / len
      if (Math.abs(p.moveX) > 0.1) p.facing = Math.sign(p.moveX)
    }
    if (p.stats.recovery > 0) p.heal(p.stats.recovery * dt)
    if (p.iframes > 0) p.iframes -= dt
  }
}

/** Co-op: a downed player is revived by a teammate standing next to them. */
function tickRevive(world: World, p: Player, dt: number): void {
  let helped = false
  for (const q of world.players) {
    if (q === p || !q.alive) continue
    if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < REVIVE_RADIUS * REVIVE_RADIUS) {
      helped = true
      break
    }
  }
  p.reviveProgress = helped ? p.reviveProgress + dt : Math.max(0, p.reviveProgress - dt * 0.5)
  if (p.reviveProgress < REVIVE_SECONDS) return
  p.alive = true
  p.hp = p.stats.maxHp * 0.4
  p.iframes = 2
  p.reviveProgress = 0
  world.events.push({ e: 'revive', playerId: p.id })
}

export function damagePlayer(world: World, p: Player, amount: number): void {
  if (!p.alive || p.iframes > 0 || world.godMode) return
  const dmg = Math.max(1, amount - p.stats.armor)
  p.hp -= dmg
  p.iframes = PLAYER_IFRAMES
  world.events.push({ e: 'player-hit', playerId: p.id, amount: Math.round(dmg) })
  if (p.hp > 0) return

  if (p.revivalsLeft > 0) {
    p.revivalsLeft--
    p.hp = p.stats.maxHp * 0.5
    p.iframes = 2.5
    world.events.push({ e: 'revive', playerId: p.id })
    return
  }
  downPlayer(world, p)
}

export function downPlayer(world: World, p: Player): void {
  p.hp = 0
  p.alive = false
  p.reviveProgress = 0
  p.moveX = p.moveY = 0
  world.events.push({ e: 'player-down', playerId: p.id })
}
