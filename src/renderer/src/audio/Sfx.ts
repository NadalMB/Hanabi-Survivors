import type { SaveSettings } from '@shared/save'
import { Music } from './Music'

/**
 * Synthesised sound effects, plus the looping soundtrack. Every effect is
 * throttled so a screen full of hits stays a texture instead of clipping.
 */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private readonly lastPlayed = new Map<string, number>()
  private gemCombo = 0
  private lastGem = 0
  private readonly music: Music

  constructor(private settings: SaveSettings) {
    this.music = new Music(settings)
    const unlock = (): void => {
      this.ensure()
      void this.ctx?.resume()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
  }

  applySettings(settings: SaveSettings): void {
    this.settings = settings
    this.music.applySettings(settings)
    if (this.master) this.master.gain.value = settings.masterVolume * settings.sfxVolume * 0.6
  }

  /** Full soundtrack level, eased in from whatever is playing. */
  musicMenu(): void {
    this.music.setScene('menu')
  }

  /** Same track, at the same level as the menus. */
  musicMatch(): void {
    this.music.setScene('match')
  }

  /** Duck only while the pause menu (or the 20-minute choice) is open. */
  duckMusic(paused: boolean): void {
    this.music.setPaused(paused)
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    try {
      this.ctx = new AudioContext()
    } catch {
      return null
    }
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 6
    comp.ratio.value = 12
    comp.attack.value = 0.002
    comp.release.value = 0.12
    this.master.connect(comp)
    comp.connect(this.ctx.destination)
    this.applySettings(this.settings)
    const len = this.ctx.sampleRate
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return this.ctx
  }

  private ready(key: string, minGapMs: number): AudioContext | null {
    const ctx = this.ensure()
    if (!ctx || ctx.state !== 'running' || !this.master) return null
    const now = performance.now()
    if (now - (this.lastPlayed.get(key) ?? 0) < minGapMs) return null
    this.lastPlayed.set(key, now)
    return ctx
  }

  private tone(ctx: AudioContext, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master!)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private burst(ctx: AudioContext, filter: BiquadFilterType, f0: number, f1: number, dur: number, gain: number, delay = 0): void {
    const t = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const biquad = ctx.createBiquadFilter()
    biquad.type = filter
    biquad.frequency.setValueAtTime(f0, t)
    biquad.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(biquad).connect(g).connect(this.master!)
    src.start(t, Math.random() * 0.5)
    src.stop(t + dur + 0.02)
  }

  hit(): void {
    const ctx = this.ready('hit', 40)
    if (ctx) this.burst(ctx, 'highpass', 3200, 1400, 0.05, 0.12)
  }

  kill(): void {
    const ctx = this.ready('kill', 35)
    if (ctx) this.tone(ctx, 'square', 520 + Math.random() * 80, 130, 0.08, 0.05)
  }

  /** Rising pitch while gems are collected in quick succession. */
  gem(): void {
    const now = performance.now()
    this.gemCombo = now - this.lastGem < 450 ? Math.min(this.gemCombo + 1, 18) : 0
    this.lastGem = now
    const ctx = this.ready('gem', 28)
    if (!ctx) return
    const f = 880 * Math.pow(2, this.gemCombo / 12)
    this.tone(ctx, 'triangle', f, f * 1.25, 0.06, 0.07)
  }

  coin(): void {
    const ctx = this.ready('coin', 60)
    if (!ctx) return
    this.tone(ctx, 'square', 1320, 1320, 0.06, 0.05)
    this.tone(ctx, 'square', 1760, 1760, 0.12, 0.05, 0.06)
  }

  heal(): void {
    const ctx = this.ready('heal', 100)
    if (!ctx) return
    ;[660, 880, 1100].forEach((f, i) => this.tone(ctx, 'sine', f, f, 0.12, 0.08, i * 0.05))
  }

  levelUp(): void {
    const ctx = this.ready('level', 150)
    if (!ctx) return
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(ctx, 'square', f, f, 0.12, 0.06, i * 0.06))
  }

  chest(): void {
    const ctx = this.ready('chest', 200)
    if (!ctx) return
    ;[392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(ctx, 'triangle', f, f, 0.18, 0.08, i * 0.07))
  }

  hurt(): void {
    const ctx = this.ready('hurt', 120)
    if (!ctx) return
    this.tone(ctx, 'sawtooth', 240, 60, 0.2, 0.12)
    this.burst(ctx, 'lowpass', 900, 200, 0.15, 0.15)
  }

  slash(): void {
    const ctx = this.ready('slash', 70)
    if (ctx) this.burst(ctx, 'bandpass', 1200, 5200, 0.12, 0.09)
  }

  thunder(): void {
    const ctx = this.ready('thunder', 70)
    if (!ctx) return
    this.burst(ctx, 'bandpass', 4200, 300, 0.28, 0.2)
    this.tone(ctx, 'square', 90, 40, 0.18, 0.05)
  }

  explosion(): void {
    const ctx = this.ready('boom', 60)
    if (!ctx) return
    this.burst(ctx, 'lowpass', 1400, 90, 0.38, 0.25)
    this.tone(ctx, 'sine', 130, 35, 0.3, 0.15)
  }

  boss(): void {
    const ctx = this.ready('boss', 500)
    if (!ctx) return
    this.tone(ctx, 'sawtooth', 82, 62, 1.3, 0.14)
    this.tone(ctx, 'sawtooth', 123, 92, 1.3, 0.08)
    this.burst(ctx, 'lowpass', 400, 60, 1.2, 0.12)
  }

  evolution(): void {
    const ctx = this.ready('evo', 300)
    if (!ctx) return
    ;[523, 784, 1047, 1568, 2093].forEach((f, i) => {
      this.tone(ctx, 'triangle', f, f, 0.3, 0.07, i * 0.08)
      this.tone(ctx, 'sine', f * 1.5, f * 1.5, 0.3, 0.03, i * 0.08)
    })
  }

  defeat(): void {
    const ctx = this.ready('defeat', 1000)
    if (!ctx) return
    ;[392, 330, 262, 196].forEach((f, i) => this.tone(ctx, 'triangle', f, f * 0.98, 0.35, 0.1, i * 0.22))
  }

  ui(): void {
    const ctx = this.ready('ui', 40)
    if (ctx) this.tone(ctx, 'sine', 900, 1200, 0.05, 0.06)
  }
}
