const MAX_OFFSET = 8
const DECAY = 3.1
const TRAUMA_CAP = 0.48

/** Trauma-based screen shake: intensity grows with trauma², so small hits stay subtle. */
export class Camera {
  offsetX = 0
  offsetY = 0
  private trauma = 0
  private time = 0

  constructor(public strength = 1) {}

  addTrauma(amount: number): void {
    this.trauma = Math.min(TRAUMA_CAP, this.trauma + amount * 0.62)
  }

  update(dt: number): void {
    this.time += dt
    this.trauma = Math.max(0, this.trauma - DECAY * dt)
    const shake = this.trauma * this.trauma * this.strength
    const t = this.time * 24
    this.offsetX = MAX_OFFSET * shake * (Math.sin(t * 1.1) + Math.sin(t * 2.3 + 1.7)) * 0.5
    this.offsetY = MAX_OFFSET * shake * (Math.sin(t * 1.7 + 0.3) + Math.sin(t * 2.9 + 4.1)) * 0.5
  }

  reset(): void {
    this.trauma = 0
    this.offsetX = this.offsetY = 0
  }
}
