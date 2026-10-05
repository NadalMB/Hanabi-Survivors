import { NET_SNAPSHOT_HZ, SIM_DT } from '@shared/constants'
import type { LobbyPlayer } from '@shared/protocol'
import type { ClientNet } from '@/net/ClientNet'
import { SnapshotApplier } from '@/net/snapshot'
import type { MenuAction } from '@/ui/Overlays'
import { loadoutFromSave } from '../data/cosmetics'
import { PLAYER_BASE_SPEED } from '../sim/config'
import { CHILL_SPEED } from '../sim/Player'
import { World } from '../sim/World'
import { SessionBase, type SessionDeps } from './SessionBase'

interface PendingInput {
  seq: number
  mx: number
  my: number
}

/** Corrections larger than this are treated as teleports instead of being smoothed. */
const SNAP_DISTANCE = 220
const CORRECTION_DECAY = 0.85

/**
 * Co-op client: renders a mirror World rebuilt from host snapshots. Remote
 * entities are interpolated; the local player is predicted from our own input
 * and reconciled against the host's acknowledged position.
 */
export class ClientSession extends SessionBase {
  private readonly applier = new SnapshotApplier()
  private lastSnapAt = 0
  private snapInterval = 1 / NET_SNAPSHOT_HZ
  private hasSnapshot = false
  private matchPaused = false

  private seq = 0
  private pending: PendingInput[] = []
  private predX = 0
  private predY = 0
  private prevPredX = 0
  private prevPredY = 0
  private offX = 0
  private offY = 0
  private roster: LobbyPlayer[] = []

  constructor(
    deps: SessionDeps,
    private readonly net: ClientNet,
    players: LobbyPlayer[]
  ) {
    super(
      deps,
      new World({
        seed: 0,
        catalog: deps.save.worldsReached,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          characterId: p.characterId,
          weaponId: p.weaponId,
          meta: {},
          loadout: p.id === net.playerId ? loadoutFromSave(deps.save) : p.cosmetics
        }))
      }),
      net.playerId
    )
    this.roster = players
    this.world.state = 'running'
    net.onSnapshot = (buf) => this.onSnapshot(buf)
    net.onMessage = (msg) => {
      switch (msg.t) {
        case 'events':
          this.world.events.push(...msg.list)
          break
        case 'choices':
          if (msg.choices) {
            if (this.levelUp.matches(msg.choices)) this.levelUp.setPeers(msg.peers ?? [])
            else this.showChoices(msg.choices, msg.level, (i) => this.net.send({ t: 'pick-upgrade', choiceIndex: i }), msg.mode ?? 'level', msg.peers ?? [])
          } else this.levelUp.hide()
          break
        case 'game-over':
          this.awardRun(msg.info, [
            { label: 'Reintentar', hint: 'R', primary: true, run: () => this.requestRestart() },
            { label: 'Volver al menú', run: () => this.exitToMenu() }
          ])
          break
        case 'restart':
          this.beginRun(msg.seed)
          break
        case 'match-paused':
          this.matchPaused = msg.paused
          if (msg.paused && !this.menuOpen && msg.name) this.hud.banner(`${msg.name} ha pausado`, ['La partida está congelada.'], 'info')
          break
        default:
          break
      }
    }
    net.onClose = (reason) => this.showDisconnected(reason)
  }

  protected get pausesWhenMenuOpen(): boolean {
    return false
  }

  private onSnapshot(buf: ArrayBuffer): void {
    const now = performance.now() / 1000
    if (this.hasSnapshot) {
      const gap = Math.min(0.25, now - this.lastSnapAt)
      this.snapInterval += (gap - this.snapInterval) * 0.1
    }
    this.applier.apply(buf, this.world, this.localId, this.snapAlpha(now), this.matchPaused ? 0 : this.snapInterval)
    this.lastSnapAt = now
    this.reconcile()
    this.hasSnapshot = true
  }

  private snapAlpha(now = performance.now() / 1000): number {
    if (!this.hasSnapshot) return 1
    return Math.max(0, Math.min(1, (now - this.lastSnapAt) / this.snapInterval))
  }

  /** Replays inputs the host hasn't processed yet on top of its authoritative position. */
  private reconcile(): void {
    const ack = this.applier.lastInputAck
    this.pending = this.pending.filter((i) => {
      const d = (i.seq - ack) & 0xffff
      return d > 0 && d < 0x8000
    })
    const step = PLAYER_BASE_SPEED * this.local.stats.moveSpeed * (this.local.chill > 0 ? CHILL_SPEED : 1) * SIM_DT
    let x = this.applier.localServerX
    let y = this.applier.localServerY
    for (const i of this.pending) {
      x += i.mx * step
      y += i.my * step
    }
    if (!this.hasSnapshot || !this.applier.localAlive || Math.hypot(this.predX - x, this.predY - y) > SNAP_DISTANCE) {
      this.offX = this.offY = 0
      this.prevPredX = x
      this.prevPredY = y
    } else {
      this.offX += this.predX - x
      this.offY += this.predY - y
    }
    this.predX = x
    this.predY = y
  }

  protected update(): void {
    if (this.ended && this.deps.input.consumePress('KeyR')) this.requestRestart()
    this.prevPredX = this.predX
    this.prevPredY = this.predY
    this.offX *= CORRECTION_DECAY
    this.offY *= CORRECTION_DECAY
    if (this.ended || !this.hasSnapshot) return
    if (this.menuOpen || this.matchPaused) {
      this.seq = (this.seq + 1) & 0xffff
      this.net.send({ t: 'input', seq: this.seq, mx: 0, my: 0 })
      this.local.moveX = this.local.moveY = 0
      return
    }

    const p = this.local
    const canMove = this.applier.localAlive && this.world.state === 'running' && !this.levelUp.visible
    const m = canMove ? this.deps.input.move() : { x: 0, y: 0 }
    this.seq = (this.seq + 1) & 0xffff
    this.net.send({ t: 'input', seq: this.seq, mx: m.x, my: m.y })
    if (!canMove) return

    this.pending.push({ seq: this.seq, mx: m.x, my: m.y })
    const step = PLAYER_BASE_SPEED * p.stats.moveSpeed * (p.chill > 0 ? CHILL_SPEED : 1) * SIM_DT
    this.predX += m.x * step
    this.predY += m.y * step
    p.moveX = m.x
    p.moveY = m.y
    if (Math.abs(m.x) > 0.1) p.facing = Math.sign(m.x)
  }

  protected openMenu(): void {
    super.openMenu()
    this.net.send({ t: 'set-pause', paused: true })
  }

  protected closeMenu(): void {
    super.closeMenu()
    this.net.send({ t: 'set-pause', paused: false })
  }

  protected interpolation(loopAlpha: number): number {
    if (this.matchPaused || this.menuOpen) return 1
    const p = this.local
    if (this.applier.localAlive) {
      const x = this.prevPredX + (this.predX - this.prevPredX) * loopAlpha + this.offX
      const y = this.prevPredY + (this.predY - this.prevPredY) * loopAlpha + this.offY
      p.prevX = p.x = x
      p.prevY = p.y = y
    } else {
      p.prevX = p.x = this.applier.localServerX
      p.prevY = p.y = this.applier.localServerY
      p.moveX = p.moveY = 0
    }
    return this.snapAlpha()
  }

  protected menuActions(): MenuAction[] {
    return [
      { label: 'Continuar', hint: 'Esc', primary: true, run: () => this.closeMenu() },
      this.settingsAction(),
      { label: 'Reiniciar', run: () => this.requestRestart() },
      { label: 'Abandonar partida', run: () => this.exitToMenu() }
    ]
  }

  private requestRestart(): void {
    this.net.send({ t: 'request-restart' })
  }

  private beginRun(seed: number): void {
    this.saveProgress()
    this.resetRunCredit()
    this.cancelPendingResult()
    this.matchPaused = false
    this.hasSnapshot = false
    this.pending = []
    this.seq = 0
    this.offX = this.offY = 0
    this.predX = this.predY = this.prevPredX = this.prevPredY = 0
    this.applier.reset()
    this.world = new World({
      seed,
      catalog: this.deps.save.worldsReached,
      players: this.roster.map((p) => ({
        id: p.id,
        name: p.name,
        characterId: p.characterId,
        weaponId: p.weaponId,
        meta: {},
        loadout: p.id === this.net.playerId ? loadoutFromSave(this.deps.save) : p.cosmetics
      }))
    })
    this.world.state = 'running'
    this.renderer.reset()
    this.levelUp.hide()
    this.gameOver.hide()
    this.closeMenu()
  }

  protected finaleActions(): MenuAction[] | null {
    return null
  }

  protected leave(): void {
    this.net.close()
  }
}
