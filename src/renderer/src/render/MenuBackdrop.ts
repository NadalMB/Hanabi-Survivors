import { Container, Sprite, Texture, type Application } from 'pixi.js'
import type { GameTextures } from './textures'

interface Drifter {
  sprite: Sprite
  vx: number
  vy: number
  spin: number
  sway: number
  phase: number
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  return Texture.from(c)
}

function ridge(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, amp: number, seed: number, top: string, bottom: string): void {
  let s = seed
  const rand = (): number => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const g = ctx.createLinearGradient(0, base - amp, 0, h)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(0, h)
  let y = base
  for (let x = 0; x <= w; x += 32) {
    y = base - amp * (0.4 + rand() * 0.6) * Math.abs(Math.sin(x / 260 + seed))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

/** Animated night scene behind the menus. Rendered with its own rAF loop while visible. */
export class MenuBackdrop {
  private readonly root = new Container()
  private readonly sky: Sprite
  private readonly moon: Sprite
  private readonly moonGlow: Sprite
  private readonly far: Sprite
  private readonly near: Sprite
  private readonly torii: Sprite
  private readonly drifters: Drifter[] = []
  private readonly lanterns: Drifter[] = []
  private raf = 0
  private last = 0
  private time = 0
  private running = false

  constructor(
    private readonly app: Application,
    tex: GameTextures
  ) {
    this.sky = new Sprite(
      canvasTexture(8, 512, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 512)
        g.addColorStop(0, '#07031a')
        g.addColorStop(0.45, '#2a0f4a')
        g.addColorStop(0.75, '#6b1f5f')
        g.addColorStop(1, '#ff7aa8')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 8, 512)
      })
    )
    const stars = new Sprite(
      canvasTexture(1024, 512, (ctx) => {
        for (let i = 0; i < 260; i++) {
          const x = Math.random() * 1024
          const y = Math.random() * 380
          const r = Math.random() * 1.3 + 0.2
          ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    )
    this.moonGlow = new Sprite(tex.glow)
    this.moonGlow.anchor.set(0.5)
    this.moonGlow.tint = 0xff9fc8
    this.moonGlow.blendMode = 'add'
    this.moon = new Sprite(tex.moon)
    this.moon.anchor.set(0.5)
    this.far = new Sprite(
      canvasTexture(2048, 400, (ctx) => {
        ridge(ctx, 2048, 400, 230, 170, 3, '#3a1a5c', '#1a0b30')
        ridge(ctx, 2048, 400, 300, 120, 7, '#26103f', '#120622')
      })
    )
    this.near = new Sprite(
      canvasTexture(2048, 300, (ctx) => {
        ridge(ctx, 2048, 300, 200, 90, 11, '#140726', '#06020f')
        // Pine silhouettes on the near ridge.
        ctx.fillStyle = '#06020f'
        for (let x = 30; x < 2048; x += 70 + Math.sin(x) * 30) {
          const h = 40 + Math.abs(Math.sin(x * 0.37)) * 60
          ctx.beginPath()
          ctx.moveTo(x, 300)
          ctx.lineTo(x - h * 0.25, 300 - h * 0.5)
          ctx.lineTo(x, 300 - h)
          ctx.lineTo(x + h * 0.25, 300 - h * 0.5)
          ctx.closePath()
          ctx.fill()
        }
      })
    )
    this.torii = new Sprite(
      canvasTexture(260, 220, (ctx) => {
        ctx.fillStyle = '#0a0414'
        ctx.beginPath()
        ctx.moveTo(0, 22)
        ctx.quadraticCurveTo(130, 40, 260, 22)
        ctx.lineTo(254, 44)
        ctx.quadraticCurveTo(130, 56, 6, 44)
        ctx.closePath()
        ctx.fill()
        ctx.fillRect(30, 70, 200, 14)
        ctx.fillRect(52, 40, 22, 180)
        ctx.fillRect(186, 40, 22, 180)
        ctx.fillRect(118, 44, 24, 28)
      })
    )
    this.torii.anchor.set(0.5, 1)

    this.root.addChild(this.sky, stars, this.moonGlow, this.moon, this.far, this.torii, this.near)

    for (let i = 0; i < 14; i++) {
      const s = new Sprite(tex.glow)
      s.anchor.set(0.5)
      s.tint = 0xffa04a
      s.blendMode = 'add'
      this.root.addChild(s)
      this.lanterns.push({ sprite: s, vx: 0, vy: -8 - Math.random() * 10, spin: 0, sway: 10 + Math.random() * 14, phase: Math.random() * 6 })
    }
    for (let i = 0; i < 160; i++) {
      const s = new Sprite(tex.petal)
      s.anchor.set(0.5)
      s.tint = Math.random() > 0.3 ? 0xffb7d5 : 0xffe3ef
      this.root.addChild(s)
      this.drifters.push({
        sprite: s,
        vx: -25 - Math.random() * 45,
        vy: 25 + Math.random() * 55,
        spin: (Math.random() - 0.5) * 4,
        sway: 20 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2
      })
    }
    this.layout(true)
  }

  private layout(scatter: boolean): void {
    const { width: w, height: h } = this.app.screen
    this.sky.width = w
    this.sky.height = h
    const k = Math.max(w / 1600, h / 900)
    this.moon.position.set(w * 0.72, h * 0.26)
    this.moon.scale.set(1.6 * k)
    this.moonGlow.position.copyFrom(this.moon.position)
    this.moonGlow.scale.set(9 * k)
    this.far.width = Math.max(w, 2048 * k)
    this.far.height = 400 * k
    this.far.y = h - this.far.height
    this.near.width = Math.max(w, 2048 * k)
    this.near.height = 300 * k
    this.near.y = h - this.near.height
    this.torii.scale.set(k * 1.1)
    this.torii.position.set(w * 0.78, h - 120 * k)
    if (!scatter) return
    for (const d of this.drifters) {
      d.sprite.position.set(Math.random() * w, Math.random() * h)
      d.sprite.scale.set(0.8 + Math.random() * 1.2)
      d.sprite.alpha = 0.5 + Math.random() * 0.5
    }
    for (const l of this.lanterns) {
      l.sprite.position.set(Math.random() * w, h * 0.4 + Math.random() * h * 0.7)
      l.sprite.scale.set(0.25 + Math.random() * 0.35)
    }
  }

  show(): void {
    if (this.running) return
    this.running = true
    this.app.stage.addChild(this.root)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  hide(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    this.app.stage.removeChild(this.root)
  }

  private frame = (now: number): void => {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.time += dt
    this.layout(false)
    const { width: w, height: h } = this.app.screen
    for (const d of this.drifters) {
      const s = d.sprite
      s.x += (d.vx + Math.sin(this.time * 1.4 + d.phase) * d.sway) * dt
      s.y += d.vy * dt
      s.rotation += d.spin * dt
      if (s.y > h + 20) {
        s.y = -20
        s.x = Math.random() * w * 1.3
      }
      if (s.x < -20) s.x = w + 20
    }
    for (const l of this.lanterns) {
      const s = l.sprite
      s.y += l.vy * dt
      s.x += Math.sin(this.time * 0.6 + l.phase) * l.sway * dt
      s.alpha = 0.55 + Math.sin(this.time * 3 + l.phase) * 0.15
      if (s.y < h * 0.15) {
        s.y = h + 40
        s.x = Math.random() * w
      }
    }
    this.moon.y = h * 0.26 + Math.sin(this.time * 0.4) * 6
    this.moonGlow.y = this.moon.y
    this.app.renderer.render(this.app.stage)
    this.raf = requestAnimationFrame(this.frame)
  }
}
