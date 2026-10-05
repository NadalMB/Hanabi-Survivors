import { Sprite, type Container, type Texture } from 'pixi.js'

/**
 * Per-frame sprite allocator: call `begin()`, take sprites with `next()`, then
 * `end()` hides whatever wasn't used. Sprites are never destroyed, only reused.
 */
export class SpritePool {
  private readonly sprites: Sprite[] = []
  private used = 0
  private lastUsed = 0

  constructor(
    private readonly layer: Container,
    private readonly anchorX = 0.5,
    private readonly anchorY = 0.5
  ) {}

  begin(): void {
    this.used = 0
  }

  next(texture: Texture): Sprite {
    let s = this.sprites[this.used]
    if (!s) {
      s = new Sprite(texture)
      s.anchor.set(this.anchorX, this.anchorY)
      this.layer.addChild(s)
      this.sprites.push(s)
    } else {
      s.texture = texture
      s.visible = true
    }
    this.used++
    return s
  }

  end(): void {
    for (let i = this.used; i < this.lastUsed; i++) this.sprites[i].visible = false
    this.lastUsed = this.used
  }
}
