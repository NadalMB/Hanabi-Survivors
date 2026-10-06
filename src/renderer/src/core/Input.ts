const DEADZONE = 0.2

const MOVE_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'Escape',
  'KeyP'
])

export interface MoveVector {
  x: number
  y: number
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export class Input {
  private readonly held = new Set<string>()
  private readonly pressed = new Set<string>()

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, true)
    window.addEventListener('keyup', this.onKeyUp, true)
    window.addEventListener('blur', this.onBlur)
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, true)
    window.removeEventListener('keyup', this.onKeyUp, true)
    window.removeEventListener('blur', this.onBlur)
  }

  /** Drop focus from menu buttons so letter keys are not swallowed by the UI. */
  releaseFocus(): void {
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) active.blur()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return
    if (!e.repeat) this.pressed.add(e.code)
    this.held.add(e.code)
    // Also track the character so AZERTY / remapped layouts still move.
    const key = e.key.length === 1 ? e.key.toLowerCase() : ''
    if (key) this.held.add(key)
    if (MOVE_CODES.has(e.code) || key === 'w' || key === 'a' || key === 's' || key === 'd') {
      e.preventDefault()
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code)
    const key = e.key.length === 1 ? e.key.toLowerCase() : ''
    if (key) this.held.delete(key)
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
    if (this.held.has('KeyA') || this.held.has('a') || this.held.has('ArrowLeft')) x -= 1
    if (this.held.has('KeyD') || this.held.has('d') || this.held.has('ArrowRight')) x += 1
    if (this.held.has('KeyW') || this.held.has('w') || this.held.has('ArrowUp')) y -= 1
    if (this.held.has('KeyS') || this.held.has('s') || this.held.has('ArrowDown')) y += 1

    const pads = navigator.getGamepads?.() ?? []
    for (const pad of pads) {
      if (!pad) continue
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
