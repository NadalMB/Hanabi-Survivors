import { BitmapFont, BitmapText, type Container } from 'pixi.js'

const FONT = 'HanabiDamage'
const LIFE = 0.75
const MAX_ACTIVE = 140

interface FloatingNumber {
  text: BitmapText
  life: number
  vx: number
  vy: number
  size: number
}

let fontInstalled = false

function installFont(): void {
  if (fontInstalled) return
  BitmapFont.install({
    name: FONT,
    style: {
      fontFamily: 'Dela Gothic One, Segoe UI Black, sans-serif',
      fontSize: 48,
      fill: '#ffffff',
      stroke: { color: '#1c0b26', width: 8, join: 'round' }
    },
    chars: '0123456789!+-',
    resolution: 1
  })
  fontInstalled = true
}

export class DamageNumbers {
  private readonly active: FloatingNumber[] = []
  private readonly free: FloatingNumber[] = []

  constructor(private readonly layer: Container) {
    installFont()
  }

  spawn(x: number, y: number, value: number, tint: number, big: boolean): void {
    if (this.active.length >= MAX_ACTIVE) {
      if (!big) return
      this.recycle(0)
    }
    let n = this.free.pop()
    if (!n) {
      const text = new BitmapText({ text: '', style: { fontFamily: FONT, fontSize: 48 } })
      text.anchor.set(0.5)
      this.layer.addChild(text)
      n = { text, life: 0, vx: 0, vy: 0, size: 1 }
    }
    n.text.text = big ? `${value}!` : String(value)
    n.text.tint = tint
    n.text.visible = true
    n.text.position.set(x + (Math.random() - 0.5) * 10, y)
    n.life = LIFE
    n.vx = (Math.random() - 0.5) * 40
    n.vy = -70 - Math.random() * 30
    n.size = big ? 0.5 : 0.32
    this.active.push(n)
  }

  private recycle(i: number): void {
    const n = this.active[i]
    n.text.visible = false
    this.active.splice(i, 1)
    this.free.push(n)
  }

  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i]
      n.life -= dt
      if (n.life <= 0) {
        this.recycle(i)
        continue
      }
      const t = 1 - n.life / LIFE
      n.vy += 120 * dt
      n.text.x += n.vx * dt
      n.text.y += n.vy * dt
      // Pop in big, settle, then shrink away.
      const pop = t < 0.12 ? 1 + (1 - t / 0.12) * 0.8 : 1
      const out = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1
      n.text.scale.set(n.size * pop * (0.6 + 0.4 * out))
      n.text.alpha = out
    }
  }

  clear(): void {
    while (this.active.length) this.recycle(this.active.length - 1)
  }
}
