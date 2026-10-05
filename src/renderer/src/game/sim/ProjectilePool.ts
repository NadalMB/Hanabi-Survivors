import { SoaPool } from './SoaPool'

export const ProjKind = { Linear: 0, Orbit: 1, Boomerang: 2, Rocket: 3 } as const

export const ProjVisual = {
  Talisman: 0,
  Seal: 1,
  Kunai: 2,
  Foxfire: 3,
  SpiritFlame: 4,
  Shuriken: 5,
  Fuuma: 6,
  Rocket: 7,
  Petal: 8
} as const

/** Collision radius each visual is drawn for; the renderer scales sprites by radius / base. */
export const VISUAL_BASE_RADIUS: readonly number[] = [9, 10, 7, 13, 15, 14, 14, 10, 7]

/** Added to a visual id so the same art draws with a legendary gold glow. */
export const PRESTIGE_GLOW = 32

export function visualIndex(visual: number): number {
  return visual >= PRESTIGE_GLOW ? visual - PRESTIGE_GLOW : visual
}

/** How many recent victims a projectile remembers, to avoid hitting the same enemy every tick. */
const HIT_MEMORY = 8

export interface ProjectileSpec {
  kind: number
  visual: number
  owner: number
  x: number
  y: number
  vx?: number
  vy?: number
  ax?: number
  ay?: number
  damage: number
  radius: number
  life: number
  pierce: number
  knockback: number
  angle?: number
  angSpeed?: number
  orbitRadius?: number
  /** Seconds before the same enemy can be hit again (Infinity = once). */
  rehit?: number
  aoe?: number
  cluster?: boolean
}

export class ProjectilePool extends SoaPool {
  readonly alive = this.u8()
  readonly kind = this.u8()
  readonly visual = this.u8()
  readonly owner = this.u8()
  readonly cluster = this.u8()
  readonly hitCursor = this.u8()
  readonly x = this.f32()
  readonly y = this.f32()
  readonly prevX = this.f32()
  readonly prevY = this.f32()
  readonly vx = this.f32()
  readonly vy = this.f32()
  readonly ax = this.f32()
  readonly ay = this.f32()
  readonly damage = this.f32()
  readonly radius = this.f32()
  readonly life = this.f32()
  readonly pierce = this.f32()
  readonly knockback = this.f32()
  readonly angle = this.f32()
  readonly angSpeed = this.f32()
  readonly orbitRadius = this.f32()
  readonly rehit = this.f32()
  readonly aoe = this.f32()
  private readonly hitIds = new Uint32Array(this.capacity * HIT_MEMORY)
  private readonly hitTimes = new Float32Array(this.capacity * HIT_MEMORY)

  spawn(s: ProjectileSpec): number {
    const i = this.allocate()
    if (i < 0) return -1
    this.alive[i] = 1
    this.kind[i] = s.kind
    this.visual[i] = s.visual
    this.owner[i] = s.owner
    this.cluster[i] = s.cluster ? 1 : 0
    this.hitCursor[i] = 0
    this.x[i] = this.prevX[i] = s.x
    this.y[i] = this.prevY[i] = s.y
    this.vx[i] = s.vx ?? 0
    this.vy[i] = s.vy ?? 0
    this.ax[i] = s.ax ?? 0
    this.ay[i] = s.ay ?? 0
    this.damage[i] = s.damage
    this.radius[i] = s.radius
    this.life[i] = s.life
    this.pierce[i] = s.pierce
    this.knockback[i] = s.knockback
    this.angle[i] = s.angle ?? 0
    this.angSpeed[i] = s.angSpeed ?? 0
    this.orbitRadius[i] = s.orbitRadius ?? 0
    this.rehit[i] = s.rehit ?? Number.POSITIVE_INFINITY
    this.aoe[i] = s.aoe ?? 0
    this.hitIds.fill(0, i * HIT_MEMORY, (i + 1) * HIT_MEMORY)
    return i
  }

  canHit(i: number, enemyId: number, time: number): boolean {
    const base = i * HIT_MEMORY
    for (let k = 0; k < HIT_MEMORY; k++) {
      if (this.hitIds[base + k] === enemyId) return time - this.hitTimes[base + k] >= this.rehit[i]
    }
    return true
  }

  recordHit(i: number, enemyId: number, time: number): void {
    const base = i * HIT_MEMORY
    for (let k = 0; k < HIT_MEMORY; k++) {
      if (this.hitIds[base + k] === enemyId) {
        this.hitTimes[base + k] = time
        return
      }
    }
    const slot = this.hitCursor[i]
    this.hitIds[base + slot] = enemyId
    this.hitTimes[base + slot] = time
    this.hitCursor[i] = (slot + 1) % HIT_MEMORY
  }

  protected override moveSlot(from: number, to: number): void {
    super.moveSlot(from, to)
    this.hitIds.copyWithin(to * HIT_MEMORY, from * HIT_MEMORY, (from + 1) * HIT_MEMORY)
    this.hitTimes.copyWithin(to * HIT_MEMORY, from * HIT_MEMORY, (from + 1) * HIT_MEMORY)
  }

  compact(): void {
    this.compactBy(this.alive)
  }
}
