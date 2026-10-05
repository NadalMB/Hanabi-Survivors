/** Frames longer than this are clamped so a stall never triggers a catch-up spiral. */
const MAX_FRAME_SECONDS = 0.25

/**
 * Fixed-timestep loop: simulation always advances in `step`-second ticks
 * (deterministic, network friendly), rendering runs once per display frame
 * and receives the interpolation factor between the last two ticks.
 */
export class GameLoop {
  private accumulator = 0
  private lastTime = 0
  private rafId = 0
  private running = false

  constructor(
    private readonly step: number,
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number, frameSeconds: number) => void
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.accumulator = 0
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private frame = (now: number): void => {
    if (!this.running) return
    const frameSeconds = Math.min((now - this.lastTime) / 1000, MAX_FRAME_SECONDS)
    this.lastTime = now
    this.accumulator += frameSeconds

    while (this.accumulator >= this.step) {
      this.update(this.step)
      this.accumulator -= this.step
    }

    this.render(this.accumulator / this.step, frameSeconds)
    this.rafId = requestAnimationFrame(this.frame)
  }
}
