import type { SaveSettings } from '@shared/save'
import trackUrl from './bgm.mp3'

/** Pause ducks the track. Menu and a running match stay at the same level. */
const PAUSE_LEVEL = 0.4
/** Loudness of the track itself. The settings sliders sit on top of this. */
const TRACK_LEVEL = 0.28
const SCENE_TAU = 1.15
const SLIDER_TAU = 0.08

/**
 * Looping soundtrack. The bytes are read from disk and decoded here: the packaged
 * file lives in an archive the system media player cannot open.
 */
export class Music {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private loading: Promise<void> | null = null
  /** One start at a time. Two overlapping starts stack the track and clip. */
  private startLock: Promise<void> | null = null
  private paused = false
  private volume = 0
  private tau = SCENE_TAU
  private raf = 0
  private last = 0

  constructor(private settings: SaveSettings) {
    const unlock = (): void => {
      void this.ctx?.resume()
      void this.ensurePlaying()
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    void this.loadBuffer()
  }

  applySettings(settings: SaveSettings): void {
    this.settings = settings
    this.tau = SLIDER_TAU
    void this.ensurePlaying()
    this.pump()
  }

  setScene(_scene: 'menu' | 'match'): void {
    this.paused = false
    this.tau = SCENE_TAU
    void this.ensurePlaying()
    this.pump()
  }

  /** Lower the track while a match is paused. Starting a run does not. */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    this.tau = SCENE_TAU
    void this.ensurePlaying()
    this.pump()
  }

  private goal(): number {
    if (!this.settings.musicEnabled) return 0
    const scene = this.paused ? PAUSE_LEVEL : 1
    return Math.min(1, Math.max(0, this.settings.masterVolume * this.settings.musicVolume * scene * TRACK_LEVEL))
  }

  private pump(): void {
    if (this.raf) return
    this.last = performance.now()
    const step = (now: number): void => {
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      const goal = this.goal()
      this.volume += (goal - this.volume) * (1 - Math.exp(-dt / this.tau))
      if (Math.abs(goal - this.volume) < 0.004) this.volume = goal
      if (this.gain) this.gain.gain.value = this.volume
      if (this.volume === goal) {
        this.raf = 0
        return
      }
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 8
      comp.ratio.value = 12
      comp.attack.value = 0.003
      comp.release.value = 0.2
      this.gain.connect(comp)
      comp.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  private async loadBuffer(): Promise<void> {
    if (this.buffer) return
    if (!this.loading) this.loading = this.fetchTrack()
    try {
      await this.loading
    } catch {
      /* The next attempt starts a fresh read. */
    }
    if (!this.buffer) this.loading = null
  }

  private async fetchTrack(): Promise<void> {
    const ctx = await this.ensureContext()
    if (!ctx) return
    const raw = await this.readTrack()
    this.buffer = await ctx.decodeAudioData(raw)
  }

  /** Electron reads the file from disk. A browser preview falls back to the bundled URL. */
  private async readTrack(): Promise<ArrayBuffer> {
    if (window.api?.readSoundtrack) {
      const bytes = new Uint8Array(await window.api.readSoundtrack())
      const copy = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(copy).set(bytes)
      return copy
    }
    const res = await fetch(trackUrl)
    if (!res.ok) throw new Error(`soundtrack ${res.status}`)
    return res.arrayBuffer()
  }

  private ensurePlaying(): Promise<void> {
    if (this.source || !this.settings.musicEnabled) return Promise.resolve()
    if (!this.startLock) {
      this.startLock = this.startSource().finally(() => {
        this.startLock = null
      })
    }
    return this.startLock
  }

  /** Starts the loop once, from silence, and only after the device is actually running. */
  private async startSource(): Promise<void> {
    if (this.source || !this.settings.musicEnabled) return
    const ctx = await this.ensureContext()
    if (!ctx || !this.gain || ctx.state !== 'running') return
    await this.loadBuffer()
    if (!this.buffer || this.source || !this.gain) return
    const src = ctx.createBufferSource()
    src.buffer = this.buffer
    src.loop = true
    src.connect(this.gain)
    this.volume = 0
    this.gain.gain.value = 0
    this.tau = 0.6
    src.start()
    this.source = src
    this.pump()
  }
}
