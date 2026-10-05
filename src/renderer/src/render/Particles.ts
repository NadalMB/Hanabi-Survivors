import { Sprite, type Container, type Texture } from 'pixi.js'

export interface EmitOptions {
  vx?: number
  vy?: number
  life: number
  scale?: number
  scaleEnd?: number
  /** Horizontal stretch relative to `scale` (e.g. for slashes). */
  aspect?: number
  alpha?: number
  tint?: number
  drag?: number
  gravity?: number
  rotation?: number
  spin?: number
  /** Rotate to face the velocity, for streaky sparks. */
  align?: boolean
  flipX?: boolean
}

interface Particle {
  sprite: Sprite
  vx: number
  vy: number
  life: number
  maxLife: number
  s0: number
  s1: number
  aspect: number
  a0: number
  drag: number
  gravity: number
  spin: number
  align: boolean
  flip: number
}

/** Render-only particles (never simulated by the host) pooled in a single layer. */
export class Particles {
  private readonly active: Particle[] = []
  private readonly free: Particle[] = []

  constructor(
    private readonly layer: Container,
    private readonly cap = 3500
  ) {}

  emit(texture: Texture, x: number, y: number, o: EmitOptions): void {
    if (this.active.length >= this.cap) return
    let p = this.free.pop()
    if (!p) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      this.layer.addChild(sprite)
      p = { sprite, vx: 0, vy: 0, life: 0, maxLife: 1, s0: 1, s1: 1, aspect: 1, a0: 1, drag: 0, gravity: 0, spin: 0, align: false, flip: 1 }
    }
    const s = p.sprite
    s.texture = texture
    s.visible = true
    s.position.set(x, y)
    s.rotation = o.rotation ?? 0
    s.tint = o.tint ?? 0xffffff
    p.vx = o.vx ?? 0
    p.vy = o.vy ?? 0
    p.life = p.maxLife = o.life
    p.s0 = o.scale ?? 1
    p.s1 = o.scaleEnd ?? p.s0
    p.aspect = o.aspect ?? 1
    p.a0 = o.alpha ?? 1
    p.drag = o.drag ?? 0
    p.gravity = o.gravity ?? 0
    p.spin = o.spin ?? 0
    p.align = o.align ?? false
    p.flip = o.flipX ? -1 : 1
    this.applyVisual(p, 0)
    this.active.push(p)
  }

  burst(texture: Texture, x: number, y: number, count: number, speed: number, o: EmitOptions): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.35 + Math.random() * 0.65)
      this.emit(texture, x, y, {
        ...o,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: o.life * (0.6 + Math.random() * 0.4),
        rotation: o.rotation ?? Math.random() * Math.PI * 2
      })
    }
  }

  private applyVisual(p: Particle, t: number): void {
    const s = p.sprite
    const scale = p.s0 + (p.s1 - p.s0) * t
    s.scale.set(scale * p.aspect * p.flip, scale)
    s.alpha = p.a0 * (1 - t * t)
  }

  update(dt: number): void {
    const list = this.active
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      p.life -= dt
      if (p.life <= 0) {
        p.sprite.visible = false
        list[i] = list[list.length - 1]
        list.pop()
        this.free.push(p)
        continue
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt)
        p.vx *= k
        p.vy *= k
      }
      p.vy += p.gravity * dt
      const s = p.sprite
      s.x += p.vx * dt
      s.y += p.vy * dt
      if (p.align) s.rotation = Math.atan2(p.vy, p.vx)
      else s.rotation += p.spin * dt
      this.applyVisual(p, 1 - p.life / p.maxLife)
    }
  }

  clear(): void {
    for (const p of this.active) {
      p.sprite.visible = false
      this.free.push(p)
    }
    this.active.length = 0
  }
}
