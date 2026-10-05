import { ENEMIES } from '@/game/data/enemies'
import type { StatKey } from '@/game/data/stats'
import { PASSIVES } from '@/game/data/passives'
import { computeWeaponStats, WEAPONS } from '@/game/data/weapons'
import { BOSS_DASH_START, BOSS_WINDUP_START, EnemyMode } from '@/game/sim/EnemyPool'
import { GEM_DISPLAY, gemTier } from '@/game/systems/pickups'
import { PickupType } from '@/game/sim/PickupPool'
import type { Player } from '@/game/sim/Player'
import { ProjKind, ProjVisual, visualIndex } from '@/game/sim/ProjectilePool'
import type { World, WorldState } from '@/game/sim/World'

/**
 * Binary world snapshot, culled around one viewer. Positions are int16 offsets
 * from the viewer, so ~10 bytes per enemy instead of ~60 as JSON.
 */
const MAGIC = 0x53
const CULL_X = 1150
const CULL_Y = 800

const WEAPON_IDS = Object.keys(WEAPONS)
const PASSIVE_IDS = Object.keys(PASSIVES)
const STATES: WorldState[] = ['running', 'levelup', 'gameover', 'victory', 'finale']

const EXTRA_STATS: StatKey[] = ['recovery', 'armor', 'might', 'area', 'speed', 'duration', 'amount', 'cooldown', 'magnet', 'luck', 'growth', 'greed', 'revival', 'critChance']

const PF_ALIVE = 1
const PF_IFRAMES = 2
const PF_MOVING = 4
const PF_CHOOSING = 8
const PF_CHILL = 16

const EF_ELITE = 1
const EF_FLASH = 2
const EF_WINDUP = 4
const EF_MINI = 8

class Writer {
  private buf = new ArrayBuffer(64 * 1024)
  private view = new DataView(this.buf)
  offset = 0

  reset(): void {
    this.offset = 0
  }

  private ensure(n: number): void {
    if (this.offset + n <= this.buf.byteLength) return
    const next = new ArrayBuffer(Math.max(this.buf.byteLength * 2, this.offset + n))
    new Uint8Array(next).set(new Uint8Array(this.buf, 0, this.offset))
    this.buf = next
    this.view = new DataView(next)
  }

  u8(v: number): void {
    this.ensure(1)
    this.view.setUint8(this.offset, v)
    this.offset += 1
  }
  i8(v: number): void {
    this.ensure(1)
    this.view.setInt8(this.offset, v)
    this.offset += 1
  }
  u16(v: number): void {
    this.ensure(2)
    this.view.setUint16(this.offset, v, true)
    this.offset += 2
  }
  i16(v: number): void {
    this.ensure(2)
    this.view.setInt16(this.offset, Math.max(-32768, Math.min(32767, Math.round(v))), true)
    this.offset += 2
  }
  u32(v: number): void {
    this.ensure(4)
    this.view.setUint32(this.offset, v >>> 0, true)
    this.offset += 4
  }
  f32(v: number): void {
    this.ensure(4)
    this.view.setFloat32(this.offset, v, true)
    this.offset += 4
  }
  patchU16(at: number, v: number): void {
    this.view.setUint16(at, v, true)
  }

  finish(): ArrayBuffer {
    return this.buf.slice(0, this.offset)
  }
}

const writer = new Writer()

export function encodeSnapshot(world: World, viewer: Player): ArrayBuffer {
  const w = writer
  w.reset()
  const ox = viewer.x
  const oy = viewer.y
  const near = (x: number, y: number): boolean => Math.abs(x - ox) < CULL_X && Math.abs(y - oy) < CULL_Y

  w.u8(MAGIC)
  w.u32(world.tick)
  w.f32(world.time)
  w.u8(STATES.indexOf(world.state))
  w.u8((world.endless ? 1 : 0) | (world.realm << 1))
  w.u16(world.level)
  w.f32(world.xp)
  w.f32(world.xpToNext)
  w.u32(world.kills)
  w.f32(world.gold)
  w.f32(world.timeBank)
  w.u16(Math.min(65535, world.bossesDefeated))
  w.f32(ox)
  w.f32(oy)

  w.u8(world.players.length)
  for (const p of world.players) {
    w.u8(p.id)
    w.f32(p.x)
    w.f32(p.y)
    w.f32(p.hp)
    w.f32(p.stats.maxHp)
    w.f32(p.stats.moveSpeed)
    for (const key of EXTRA_STATS) w.f32(p.stats[key])
    w.i8(p.facing)
    const moving = Math.abs(p.moveX) + Math.abs(p.moveY) > 0.1
    w.u8((p.alive ? PF_ALIVE : 0) | (p.iframes > 0 ? PF_IFRAMES : 0) | (moving ? PF_MOVING : 0) | (p.choices ? PF_CHOOSING : 0) | (p.chill > 0 ? PF_CHILL : 0))
    w.u16(p.lastInputSeq & 0xffff)
    w.u8(Math.min(255, Math.round(p.reviveProgress * 85)))
    w.u16(Math.min(65535, p.kills))
    w.u8(p.weapons.length)
    for (const slot of p.weapons) {
      w.u8(WEAPON_IDS.indexOf(slot.id))
      w.u8(slot.level)
      w.u8(slot.prestige[0] ?? 0)
      w.u8(slot.prestige[1] ?? 0)
      w.u8(slot.prestige[2] ?? 0)
      w.u8(slot.prestige[3] ?? 0)
      w.f32(slot.stats.area)
      w.u8(Math.round(Math.max(0, Math.min(1, slot.cooldown / slot.stats.cooldown)) * 255))
    }
    w.u8(p.passives.length)
    for (const ps of p.passives) {
      w.u8(PASSIVE_IDS.indexOf(ps.id))
      w.u8(ps.level)
      w.u8(Math.min(255, ps.power))
    }
  }

  const e = world.enemies
  const enemyCountAt = w.offset
  w.u16(0)
  let n = 0
  for (let i = 0; i < e.count; i++) {
    const bossMark = ENEMIES[e.type[i]].boss
    if (!e.alive[i] || (!bossMark && !near(e.x[i], e.y[i]))) continue
    w.u32(e.id[i])
    w.u8(e.type[i])
    const winding = e.mode[i] === EnemyMode.Boss && e.mark[i] > 0 && e.mark[i] < 50
    w.u8((e.elite[i] ? EF_ELITE : 0) | (e.flash[i] > 0 ? EF_FLASH : 0) | (winding ? EF_WINDUP : 0) | (e.mini[i] ? EF_MINI : 0))
    w.i16(e.x[i] - ox)
    w.i16(e.y[i] - oy)
    if (ENEMIES[e.type[i]].boss) w.u8(Math.round(Math.max(0, e.hp[i] / e.maxHp[i]) * 255))
    n++
  }
  w.patchU16(enemyCountAt, n)

  const pr = world.projectiles
  const projCountAt = w.offset
  w.u16(0)
  n = 0
  for (let i = 0; i < pr.count; i++) {
    if (!pr.alive[i] || !near(pr.x[i], pr.y[i])) continue
    w.u8(pr.visual[i])
    w.i16(pr.x[i] - ox)
    w.i16(pr.y[i] - oy)
    // Orbiting projectiles have no linear velocity; send their tangential motion instead.
    let vx = pr.vx[i]
    let vy = pr.vy[i]
    if (pr.kind[i] === ProjKind.Orbit) {
      const r = pr.orbitRadius[i] * pr.angSpeed[i]
      vx = -Math.sin(pr.angle[i]) * r
      vy = Math.cos(pr.angle[i]) * r
    }
    w.i16(vx)
    w.i16(vy)
    w.u8(Math.min(255, Math.round(pr.radius[i] * 4)))
    n++
  }
  w.patchU16(projCountAt, n)

  const pk = world.pickups
  const pickCountAt = w.offset
  w.u16(0)
  n = 0
  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i]) continue
    const pinned = pk.type[i] === PickupType.Chest || pk.type[i] === PickupType.Portal
    if (!pinned && !near(pk.x[i], pk.y[i])) continue
    w.u8(pk.type[i])
    const v = pk.value[i]
    w.u8(pk.type[i] === PickupType.Gem ? gemTier(v) : 0)
    w.u8(pk.owner[i])
    if (pinned) {
      w.f32(pk.x[i])
      w.f32(pk.y[i])
    } else {
      w.i16(pk.x[i] - ox)
      w.i16(pk.y[i] - oy)
    }
    n++
  }
  w.patchU16(pickCountAt, n)

  return w.finish()
}

export function isSnapshot(buf: ArrayBuffer): boolean {
  return buf.byteLength > 0 && new DataView(buf).getUint8(0) === MAGIC
}


/**
 * Applies a snapshot to a client-side mirror World. `alpha` is how far the
 * renderer currently is between the previous two snapshots, so entities
 * continue smoothly from where they were drawn instead of snapping.
 */
export class SnapshotApplier {
  private readonly dispX = new Float32Array(4096)
  private readonly dispY = new Float32Array(4096)
  private readonly index = new Map<number, number>()
  lastInputAck = 0
  localServerX = 0
  localServerY = 0
  localAlive = true

  /** Drops interpolation remembered from the previous run. */
  reset(): void {
    this.index.clear()
    this.lastInputAck = 0
    this.localServerX = 0
    this.localServerY = 0
    this.localAlive = true
  }

  apply(buf: ArrayBuffer, world: World, localId: number, alpha: number, interval: number): void {
    const v = new DataView(buf)
    let o = 1
    const u8 = (): number => v.getUint8(o++)
    const i8 = (): number => v.getInt8(o++)
    const u16 = (): number => {
      const x = v.getUint16(o, true)
      o += 2
      return x
    }
    const i16 = (): number => {
      const x = v.getInt16(o, true)
      o += 2
      return x
    }
    const u32 = (): number => {
      const x = v.getUint32(o, true)
      o += 4
      return x
    }
    const f32 = (): number => {
      const x = v.getFloat32(o, true)
      o += 4
      return x
    }

    world.tick = u32()
    world.time = f32()
    world.state = STATES[u8()] ?? 'running'
    const worldFlags = u8()
    world.endless = (worldFlags & 1) === 1
    world.realm = worldFlags >> 1
    world.level = u16()
    world.xp = f32()
    world.xpToNext = f32()
    world.kills = u32()
    world.gold = f32()
    world.timeBank = f32()
    world.bossesDefeated = u16()
    const ox = f32()
    const oy = f32()

    const playerCount = u8()
    for (let k = 0; k < playerCount; k++) {
      const id = u8()
      const p = world.playerById(id)
      const x = f32()
      const y = f32()
      const hp = f32()
      const maxHp = f32()
      const moveSpeed = f32()
      const extra: Partial<Record<StatKey, number>> = {}
      for (const key of EXTRA_STATS) extra[key] = f32()
      const facing = i8()
      const flags = u8()
      const ack = u16()
      const revive = u8() / 85
      const kills = u16()
      const weapons: { id: string; level: number; area: number; cd: number; prestige: [number, number, number, number] }[] = []
      const nw = u8()
      for (let j = 0; j < nw; j++) {
        weapons.push({
          id: WEAPON_IDS[u8()],
          level: u8(),
          prestige: [u8(), u8(), u8(), u8()],
          area: f32(),
          cd: u8() / 255
        })
      }
      const passives: { id: string; level: number; power: number }[] = []
      const np = u8()
      for (let j = 0; j < np; j++) passives.push({ id: PASSIVE_IDS[u8()], level: u8(), power: u8() })
      if (!p) continue

      syncLoadout(p, weapons, passives)
      p.kills = kills
      p.stats.maxHp = maxHp
      p.stats.moveSpeed = moveSpeed
      for (const key of EXTRA_STATS) p.stats[key] = extra[key] ?? p.stats[key]
      for (const w of p.weapons) p.refreshWeapon(w)
      p.hp = hp
      p.facing = facing || 1
      p.alive = (flags & PF_ALIVE) !== 0
      p.iframes = flags & PF_IFRAMES ? 0.1 : 0
      p.chill = flags & PF_CHILL ? 0.25 : 0
      const moving = (flags & PF_MOVING) !== 0
      p.reviveProgress = revive
      if (id === localId) {
        this.lastInputAck = ack
        this.localServerX = x
        this.localServerY = y
        this.localAlive = p.alive
        continue
      }
      p.moveX = moving ? facing : 0
      p.moveY = 0
      p.prevX = p.prevX + (p.x - p.prevX) * alpha
      p.prevY = p.prevY + (p.y - p.prevY) * alpha
      p.x = x
      p.y = y
    }

    // Enemies: continue from the currently displayed position when the id is known.
    // Displayed positions are captured first because the pool is overwritten in place.
    const e = world.enemies
    const index = this.index
    index.clear()
    for (let i = 0; i < e.count && i < this.dispX.length; i++) {
      this.dispX[i] = e.prevX[i] + (e.x[i] - e.prevX[i]) * alpha
      this.dispY[i] = e.prevY[i] + (e.y[i] - e.prevY[i]) * alpha
      index.set(e.id[i], i)
    }
    const oldX = this.dispX
    const oldY = this.dispY

    const enemyCount = Math.min(u16(), e.capacity)
    for (let i = 0; i < enemyCount; i++) {
      const id = u32()
      const type = u8()
      const flags = u8()
      const x = ox + i16()
      const y = oy + i16()
      const boss = ENEMIES[type].boss
      e.maxHp[i] = 255
      e.hp[i] = boss ? u8() : 255
      const prev = index.get(id)
      const elite = (flags & EF_ELITE) !== 0
      const mini = (flags & EF_MINI) !== 0
      e.id[i] = id
      e.type[i] = type
      e.alive[i] = 1
      e.elite[i] = elite ? 1 : 0
      e.mini[i] = mini ? 1 : 0
      e.flash[i] = flags & EF_FLASH ? 0.1 : 0
      e.radius[i] = ENEMIES[type].radius * (elite ? 1.5 : 1) * (mini ? 0.62 : 1)
      const windup = (flags & EF_WINDUP) !== 0
      e.mode[i] = boss ? EnemyMode.Boss : EnemyMode.Chase
      e.mark[i] = windup ? 1 : 0
      e.timer[i] = windup ? (BOSS_WINDUP_START + BOSS_DASH_START) / 2 : BOSS_WINDUP_START + 1
      e.prevX[i] = prev !== undefined ? oldX[prev] : x
      e.prevY[i] = prev !== undefined ? oldY[prev] : y
      e.x[i] = x
      e.y[i] = y
    }
    e.count = enemyCount

    // Projectiles have no ids: extrapolate along their velocity until the next snapshot.
    const pr = world.projectiles
    const projCount = Math.min(u16(), pr.capacity)
    for (let i = 0; i < projCount; i++) {
      const visual = u8()
      const x = ox + i16()
      const y = oy + i16()
      const vx = i16()
      const vy = i16()
      pr.alive[i] = 1
      pr.visual[i] = visual
      pr.kind[i] = visualIndex(visual) === ProjVisual.Rocket ? ProjKind.Rocket : ProjKind.Linear
      pr.vx[i] = vx
      pr.vy[i] = vy
      pr.radius[i] = u8() / 4
      pr.prevX[i] = x
      pr.prevY[i] = y
      pr.x[i] = x + vx * interval
      pr.y[i] = y + vy * interval
    }
    pr.count = projCount

    const pk = world.pickups
    const pickCount = Math.min(u16(), pk.capacity)
    for (let i = 0; i < pickCount; i++) {
      const type = u8()
      const tier = u8()
      const owner = u8()
      const chest = type === PickupType.Chest || type === PickupType.Portal
      const x = chest ? f32() : ox + i16()
      const y = chest ? f32() : oy + i16()
      pk.alive[i] = 1
      pk.type[i] = type
      pk.owner[i] = owner
      pk.value[i] = type === PickupType.Gem ? (GEM_DISPLAY[tier] ?? 1) : 1
      pk.attracted[i] = 0
      pk.prevX[i] = pk.x[i] = x
      pk.prevY[i] = pk.y[i] = y
    }
    pk.count = pickCount
  }
}

function syncLoadout(
  p: Player,
  weapons: { id: string; level: number; area: number; cd: number; prestige: [number, number, number, number] }[],
  passives: { id: string; level: number; power: number }[]
): void {
  const passiveKey = passives.map((s) => `${s.id}:${s.level}:${s.power}`).join()
  if (passiveKey !== p.passives.map((s) => `${s.id}:${s.level}:${s.power}`).join()) {
    p.passives.length = 0
    for (const s of passives) p.passives.push({ ...s, power: s.power || s.level })
    p.recomputeStats()
  }
  const weaponKey = (id: string, level: number, prestige: readonly number[]): string => `${id}:${level}:${prestige.join(',')}`
  if (weapons.map((w) => weaponKey(w.id, w.level, w.prestige)).join() !== p.weapons.map((w) => weaponKey(w.id, w.level, w.prestige)).join()) {
    p.weapons.length = 0
    for (const w of weapons) p.addWeapon(w.id)
    p.weapons.forEach((slot, i) => {
      slot.level = weapons[i].level
      slot.prestige = weapons[i].prestige
      slot.stats = computeWeaponStats(WEAPONS[slot.id], slot.level, p.stats, slot.prestige)
    })
  }
  p.weapons.forEach((slot, i) => {
    slot.stats.area = weapons[i].area
    slot.cooldown = weapons[i].cd * slot.stats.cooldown
  })
}
