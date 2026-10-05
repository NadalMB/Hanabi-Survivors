const DEADZONE = 0.2

export interface MoveVector {
  x: number
  y: number
}

export class Input {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!e.repeat) this.pressed.add(e.code)
    this.held.add(e.code)
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
  }

  private onBlur = (): void => {
    this.held.clear()
  }

  isDown(code: string): boolean {
    return this.held.has(code)
  }

  /** Edge-triggered: true once per physical key press. */
  consumePress(code: string): boolean {
    return this.pressed.delete(code)
  }

  clearPresses(): void {
    this.pressed.clear()
  }

  move(): MoveVector {
    let x = 0
    let y = 0
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) x -= 1
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) x += 1
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) y -= 1
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) y += 1

    const pad = navigator.getGamepads?.()[0]
    if (pad) {
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      if (Math.hypot(ax, ay) > DEADZONE) {
        x += ax
        y += ay
      }
      if (pad.buttons[14]?.pressed) x -= 1
      if (pad.buttons[15]?.pressed) x += 1
      if (pad.buttons[12]?.pressed) y -= 1
      if (pad.buttons[13]?.pressed) y += 1
    }

    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }
}
