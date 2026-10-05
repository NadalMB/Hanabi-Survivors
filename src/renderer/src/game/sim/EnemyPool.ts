import { ENEMIES } from '../data/enemies'
import { SoaPool } from './SoaPool'

export const EnemyMode = { Chase: 0, Straight: 1, Boss: 2, Leap: 3, Orbit: 4, Weave: 5 } as const

export const BOSS_DASH_PERIOD = 5
export const BOSS_WINDUP_START = 1.4
export const BOSS_DASH_START = 0.8

export class EnemyPool extends SoaPool {
  readonly id = this.u32()
  readonly alive = this.u8()
  readonly type = this.u8()
  readonly elite = this.u8()
  /** Smaller boss with the same attacks and a chest, not a full boss kill. */
  readonly mini = this.u8()
  readonly mode = this.u8()
  readonly x = this.f32()
  readonly y = this.f32()
  readonly prevX = this.f32()
  readonly prevY = this.f32()
  readonly kbX = this.f32()
  readonly kbY = this.f32()
  readonly dirX = this.f32()
  readonly dirY = this.f32()
  readonly hp = this.f32()
  readonly maxHp = this.f32()
  readonly speed = this.f32()
  readonly damage = this.f32()
  readonly radius = this.f32()
  readonly xp = this.f32()
  readonly flash = this.f32()
  readonly kbResist = this.f32()
  readonly timer = this.f32()
  /** Attack phase, so a boss only telegraphs and detonates once per cycle. */
  readonly mark = this.u8()
  readonly auxX = this.f32()
  readonly auxY = this.f32()
  private nextId = 1

  spawn(type: number, x: number, y: number, hpScale: number, damageScale: number, elite: boolean, mode: number, mini = false): number {
    const i = this.allocate()
    if (i < 0) return -1
    const def = ENEMIES[type]
    this.id[i] = this.nextId++
    this.alive[i] = 1
    this.type[i] = type
    this.elite[i] = elite ? 1 : 0
    this.mini[i] = mini ? 1 : 0
    this.mode[i] = mode
    this.x[i] = this.prevX[i] = x
    this.y[i] = this.prevY[i] = y
    this.kbX[i] = this.kbY[i] = 0
    this.dirX[i] = this.dirY[i] = 0
    this.hp[i] = this.maxHp[i] = def.hp * hpScale * (elite ? 12 : 1) * (mini ? 0.32 : 1)
    this.speed[i] = def.speed * (mode === EnemyMode.Straight ? 1.6 : 1)
    this.damage[i] = def.damage * damageScale * (elite ? 1.5 : 1) * (mini ? 0.75 : 1)
    this.radius[i] = def.radius * (elite ? 1.5 : 1) * (mini ? 0.62 : 1)
    this.xp[i] = def.xp * (elite ? 10 : 1) * (mini ? 0.45 : 1)
    this.flash[i] = 0
    this.kbResist[i] = Math.min(1, def.knockbackResist + (elite ? 0.4 : 0))
    this.timer[i] = mode === EnemyMode.Leap ? 0.35 + (this.nextId % 5) * 0.12 : mode === EnemyMode.Orbit ? 2.2 : BOSS_DASH_PERIOD
    this.mark[i] = 0
    this.auxX[i] = this.auxY[i] = 0
    return i
  }

  compact(): void {
    this.compactBy(this.alive)
  }
}
