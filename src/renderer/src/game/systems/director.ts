import { MAX_ENEMIES } from '@shared/constants'
import { EnemyType, ENEMIES } from '../data/enemies'
import {
  ELITE_FIRST_SECONDS,
  ELITE_INTERVAL_SECONDS,
  MINIBOSS_FIRST_SECONDS,
  enemyDamageScale,
  enemyHpScale,
  spawnRate,
  targetEnemyCount,
  type WaveEvent
} from '../data/waves'
import { endlessBosses, portalPressure, spawnTable, waveEvents, worldPower } from '../data/worlds'
import { RUN_DURATION_SECONDS, SPAWN_RADIUS } from '../sim/config'
import { EnemyMode } from '../sim/EnemyPool'
import type { Player } from '../sim/Player'
import type { World } from '../sim/World'

/** Decides what spawns, where and when: a rising budget plus scripted events. */
export class SpawnDirector {
  private accumulator = 0
  private nextEvent = 0
  private nextElite = ELITE_FIRST_SECONDS
  private nextMini = MINIBOSS_FIRST_SECONDS
  private nextEndlessBoss = RUN_DURATION_SECONDS
  private endlessBoss = 0

  /** A new world starts its clock, its script and its hordes from the beginning. */
  reset(): void {
    this.accumulator = 0
    this.nextEvent = 0
    this.nextElite = ELITE_FIRST_SECONDS
    this.nextMini = MINIBOSS_FIRST_SECONDS
    this.nextEndlessBoss = RUN_DURATION_SECONDS
    this.endlessBoss = 0
  }

  update(world: World, dt: number): void {
    growPressure(world)
    const minutes = world.time / 60
    const script = waveEvents(world.realm)
    while (this.nextEvent < script.length && script[this.nextEvent].at <= minutes) {
      runEvent(world, script[this.nextEvent++], minutes)
    }
    if (world.endless && world.time >= this.nextEndlessBoss) {
      this.nextEndlessBoss += 85
      const roster = endlessBosses(world.realm)
      runEvent(world, { at: minutes, kind: 'boss', type: roster[this.endlessBoss % roster.length] }, minutes)
      this.endlessBoss++
    }
    if (world.time >= this.nextMini) {
      const gap = minutes > 20 ? 26 : minutes > 10 ? 38 : 52
      this.nextMini += gap
      spawnMiniboss(world, minutes)
    }

    const alive = world.alivePlayerCount()
    if (alive === 0) return
    const coop = 1 + 0.6 * (alive - 1)
    const target = Math.min(MAX_ENEMIES * 0.8, targetEnemyCount(minutes) * coop)
    const count = world.enemies.count

    let rate = spawnRate(minutes) * coop
    if (count < target) rate *= 1 + ((target - count) / target) * 4
    else rate *= 0.15

    this.accumulator += rate * dt
    while (this.accumulator >= 1) {
      this.accumulator -= 1
      const type = pickType(world, minutes)
      if (type >= 0) spawnNearPlayer(world, type, minutes, false)
    }

    if (world.time >= this.nextElite) {
      const gap = minutes > 20 ? 22 : minutes > 12 ? 32 : ELITE_INTERVAL_SECONDS
      this.nextElite += gap
      spawnNearPlayer(world, strongestType(world, minutes), minutes, true)
      if (minutes > 12) spawnNearPlayer(world, strongestType(world, minutes), minutes, true)
    }
  }
}

function activeEntries(world: World, minutes: number) {
  return spawnTable(world.realm).filter((s) => minutes >= s.from && minutes < s.to)
}

function pickType(world: World, minutes: number): number {
  const entries = activeEntries(world, minutes)
  const idx = world.rng.weightedIndex(entries, (s) => s.weight)
  return idx >= 0 ? entries[idx].type : -1
}

function moveMode(type: number): number {
  if (ENEMIES[type].boss) return EnemyMode.Boss
  if (type === EnemyType.Tengu || type === EnemyType.Kappa || type === EnemyType.Amanojaku || type === EnemyType.Isoonna) return EnemyMode.Leap
  if (type === EnemyType.Chochin || type === EnemyType.Hozuki) return EnemyMode.Orbit
  if (type === EnemyType.Nue || type === EnemyType.Baku) return EnemyMode.Weave
  return EnemyMode.Chase
}

function strongestType(world: World, minutes: number): number {
  let best = spawnTable(world.realm)[0]?.type ?? 0
  for (const s of activeEntries(world, minutes)) if (ENEMIES[s.type].hp > ENEMIES[best].hp) best = s.type
  return best
}

/** Living enemies thicken as soon as the portal is on the ground, and faster the longer it stays. */
function growPressure(world: World): void {
  if (!world.portalOpen) return
  const next = portalPressure((world.time - world.portalOpenedAt) / 60)
  const ratio = next / Math.max(0.001, world.pressure)
  if (ratio <= 1.002) return
  const e = world.enemies
  for (let i = 0; i < e.count; i++) {
    if (!e.alive[i]) continue
    e.damage[i] *= ratio
    e.maxHp[i] *= ratio
    e.hp[i] *= ratio
  }
  world.pressure = next
}

function coopHpScale(world: World, boss: boolean): number {
  return 1 + (boss ? 0.8 : 0.5) * (world.alivePlayerCount() - 1)
}

function spawnAt(world: World, type: number, x: number, y: number, minutes: number, elite: boolean, mode: number, mini = false): number {
  const boss = ENEMIES[type].boss || mini
  const power = worldPower(world.realm) * world.pressure * (ENEMIES[type].gate ? 1.35 : 1)
  return world.enemies.spawn(type, x, y, enemyHpScale(minutes) * coopHpScale(world, boss) * power, enemyDamageScale(minutes) * power, elite, mode, mini)
}

function spawnMiniboss(world: World, minutes: number): void {
  const p = world.randomAlivePlayer()
  if (!p) return
  const roster = endlessBosses(world.realm)
  const type = roster[world.rng.int(roster.length)]
  const angle = world.rng.next() * Math.PI * 2
  const i = spawnAt(world, type, p.x + Math.cos(angle) * SPAWN_RADIUS, p.y + Math.sin(angle) * SPAWN_RADIUS, minutes, false, EnemyMode.Boss, true)
  if (i >= 0) world.events.push({ e: 'boss', enemyType: type, mini: true })
}

function spawnNearPlayer(world: World, type: number, minutes: number, elite: boolean): void {
  const p = world.randomAlivePlayer()
  if (!p) return
  const rng = world.rng
  // Bias spawns toward where the player is heading so running away isn't free.
  const angle = rng.chance(0.5) ? Math.atan2(p.aimY, p.aimX) + rng.range(-1.2, 1.2) : rng.next() * Math.PI * 2
  const dist = SPAWN_RADIUS + rng.next() * 120
  spawnAt(world, type, p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, minutes, elite, moveMode(type))
}

function runEvent(world: World, ev: WaveEvent, minutes: number): void {
  const p = world.randomAlivePlayer()
  if (!p) return
  const rng = world.rng
  switch (ev.kind) {
    case 'boss': {
      const angle = rng.next() * Math.PI * 2
      spawnAt(world, ev.type, p.x + Math.cos(angle) * SPAWN_RADIUS, p.y + Math.sin(angle) * SPAWN_RADIUS, minutes, false, EnemyMode.Boss)
      world.events.push({ e: 'boss', enemyType: ev.type })
      break
    }
    case 'ring': {
      const radius = SPAWN_RADIUS * 0.9
      for (let k = 0; k < ev.count; k++) {
        const a = (k / ev.count) * Math.PI * 2
        spawnAt(world, ev.type, p.x + Math.cos(a) * radius, p.y + Math.sin(a) * radius, minutes, false, moveMode(ev.type))
      }
      break
    }
    case 'swarm':
      spawnSwarm(world, p, ev.type, ev.count, minutes)
      break
  }
}

/** A flock that crosses the screen in a straight line through the player's position. */
function spawnSwarm(world: World, p: Player, type: number, count: number, minutes: number): void {
  const rng = world.rng
  const side = rng.next() * Math.PI * 2
  const dirX = -Math.cos(side)
  const dirY = -Math.sin(side)
  const originX = p.x + Math.cos(side) * SPAWN_RADIUS
  const originY = p.y + Math.sin(side) * SPAWN_RADIUS
  for (let k = 0; k < count; k++) {
    const lateral = rng.range(-320, 320)
    const depth = rng.range(0, 260)
    const i = spawnAt(
      world,
      type,
      originX - dirY * lateral - dirX * depth,
      originY + dirX * lateral - dirY * depth,
      minutes,
      false,
      EnemyMode.Straight
    )
    if (i < 0) break
    world.enemies.dirX[i] = dirX
    world.enemies.dirY[i] = dirY
  }
}
