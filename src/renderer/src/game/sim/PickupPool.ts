import { SoaPool } from './SoaPool'

export const PickupType = { Gem: 0, Heal: 1, Gold: 2, Chest: 3, Magnet: 4, Portal: 5 } as const

export class PickupPool extends SoaPool {
  readonly alive = this.u8()
  readonly type = this.u8()
  readonly attracted = this.u8()
  readonly target = this.u8()
  readonly x = this.f32()
  readonly y = this.f32()
  readonly prevX = this.f32()
  readonly prevY = this.f32()
  readonly vx = this.f32()
  readonly vy = this.f32()
  readonly value = this.f32()
  readonly speed = this.f32()
  readonly age = this.f32()
  /** 0 = anyone may take it. A player id means that chest belongs to them alone. */
  readonly owner = this.u8()

  spawn(type: number, x: number, y: number, value: number, vx = 0, vy = 0, owner = 0): number {
    const i = this.allocate()
    if (i < 0) return -1
    this.alive[i] = 1
    this.type[i] = type
    this.attracted[i] = 0
    this.target[i] = 0
    this.x[i] = this.prevX[i] = x
    this.y[i] = this.prevY[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.value[i] = value
    this.speed[i] = 0
    this.age[i] = 0
    this.owner[i] = owner
    return i
  }

  compact(): void {
    this.compactBy(this.alive)
  }
}
