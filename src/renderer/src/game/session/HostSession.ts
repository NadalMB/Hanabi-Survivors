import { NET_SNAPSHOT_HZ, SIM_HZ, SIM_DT } from '@shared/constants'
import type { ChestPeerView, GameEvent, GameOverInfo, PlayerId, UpgradeChoice } from '@shared/protocol'
import type { MoveVector } from '@/core/Input'
import { HOST_PLAYER_ID, type HostNet } from '@/net/HostNet'
import { encodeSnapshot } from '@/net/snapshot'
import type { MenuAction } from '@/ui/Overlays'
import { autopilot } from '../autopilot'
import { EnemyType } from '../data/enemies'
import { loadoutFromSave } from '../data/cosmetics'
import { metaMods } from '../data/meta'
import { SPAWN_RADIUS } from '../sim/config'
import { EnemyMode } from '../sim/EnemyPool'
import type { Player } from '../sim/Player'
import { World } from '../sim/World'
import { openChest } from '../systems/upgrades'
import { SessionBase, type SessionDeps } from './SessionBase'

export interface HostOptions {
  characterId: string
  weaponId?: string
  /** Present when hosting a co-op run; absent for solo. */
  net?: HostNet
  seed?: number
  autoplay?: boolean
  fastForwardSeconds?: number
  god?: boolean
}

const SNAPSHOT_EVERY = Math.round(SIM_HZ / NET_SNAPSHOT_HZ)
const EVENT_RANGE = 1400
const MAX_DAMAGE_EVENTS = 40

/** Runs the authoritative World: solo play, or the host of a co-op run. */
export class HostSession extends SessionBase {
  private readonly net: HostNet | undefined
  private readonly outbox: GameEvent[] = []
  private eventCursor = 0
  private replicateTicks = 0
  private readonly sentChoices = new Map<PlayerId, string>()
  /** Remote players who have the pause menu open. Their ids freeze the simulation. */
  private readonly remotePaused = new Map<PlayerId, string>()
  private announcedPause = false

  constructor(
    deps: SessionDeps,
    private readonly opts: HostOptions
  ) {
    super(deps, HostSession.createWorld(deps, opts), HOST_PLAYER_ID)
    this.net = opts.net
    if (this.net) {
      this.net.onGameMessage = (pid, msg) => {
        if (msg.t === 'input') this.world.setInput(pid, msg.mx, msg.my, msg.seq)
        else if (msg.t === 'pick-upgrade') this.world.chooseUpgrade(pid, msg.choiceIndex)
        else if (msg.t === 'set-pause') {
          const name = this.world.playerById(pid)?.name ?? 'Un jugador'
          if (msg.paused) this.remotePaused.set(pid, name)
          else this.remotePaused.delete(pid)
          this.syncPause()
        } else if (msg.t === 'request-restart') this.restart()
      }
      this.net.onPlayerLeft = (pid) => {
        const p = this.world.playerById(pid)
        this.remotePaused.delete(pid)
        this.world.disconnectPlayer(pid)
        this.syncPause()
        if (p) this.hud.banner(`${p.name} se ha desconectado`)
      }
    } else {
      window.addEventListener('blur', this.onBlur)
    }
    if (opts.fastForwardSeconds) this.fastForward(opts.fastForwardSeconds)
  }

  private static createWorld(deps: SessionDeps, opts: HostOptions): World {
    const seed = opts.seed ?? (Math.random() * 0x100000000) >>> 0
    const players = opts.net
      ? opts.net.lobby.map((p) => ({
          id: p.id,
          name: p.name,
          characterId: p.characterId,
          weaponId: p.weaponId,
          meta: metaMods(p.id === HOST_PLAYER_ID ? deps.save.metaUpgrades : opts.net!.metaFor(p.id)),
          loadout: p.id === HOST_PLAYER_ID ? loadoutFromSave(deps.save) : p.cosmetics
        }))
      : [{ id: HOST_PLAYER_ID, name: deps.save.settings.playerName, characterId: opts.characterId, weaponId: opts.weaponId, meta: metaMods(deps.save.metaUpgrades), loadout: loadoutFromSave(deps.save) }]
    const world = new World({ seed, players, catalog: deps.save.worldsReached })
    world.godMode = deps.debug && !!opts.god
    return world
  }

  protected get pausesWhenMenuOpen(): boolean {
    return true
  }

  destroy(): void {
    window.removeEventListener('blur', this.onBlur)
    super.destroy()
  }

  private onBlur = (): void => {
    if (!this.ended && !this.menuOpen && this.world.state === 'running' && !this.opts.autoplay) this.openMenu()
  }

  private move(): MoveVector {
    return this.opts.autoplay ? autopilot(this.world, this.local) : this.deps.input.move()
  }

  private fastForward(seconds: number): void {
    const world = this.world
    for (let t = 0; t < seconds; t += SIM_DT) {
      while (world.state === 'levelup') world.chooseUpgrade(HOST_PLAYER_ID, 0)
      if (world.state === 'finale') world.continueEndless()
      if (world.state !== 'running') break
      const m = autopilot(world, this.local)
      world.setInput(HOST_PLAYER_ID, m.x, m.y)
      world.update(SIM_DT)
    }
    world.events.length = 0
  }

  // ------------------------------------------------------------------ loop

  protected update(dt: number): void {
    if (this.ended && this.deps.input.consumePress('KeyR')) this.restart()
    if (this.deps.debug && !this.menuOpen) this.debugKeys()
    const world = this.world
    const frozen = this.ended || this.menuOpen || this.remotePaused.size > 0

    if (!frozen) {
      if (world.state === 'running') {
        const m = this.local.alive ? this.move() : { x: 0, y: 0 }
        world.setInput(HOST_PLAYER_ID, m.x, m.y)
        world.update(dt)
      }

      const local = this.local
      if (world.state === 'levelup' && local.choices) {
        const peers = local.offer === 'chest' ? world.chestPeers(local.id) : []
        if (this.opts.autoplay) world.chooseUpgrade(HOST_PLAYER_ID, 0)
        else if (!this.levelUp.visible) this.showChoices(local.choices, world.level, (i) => this.world.chooseUpgrade(HOST_PLAYER_ID, i), local.offer ?? 'level', peers)
        else if (local.offer === 'chest') this.levelUp.setPeers(peers)
      } else if (this.levelUp.visible && !local.choices) this.levelUp.hide()

      if (world.state === 'gameover' || world.state === 'victory') this.finish()
    }

    if (this.net && !this.ended) this.replicate()
  }

  protected interpolation(loopAlpha: number): number {
    const frozen = this.menuOpen || this.remotePaused.size > 0 || this.world.state !== 'running'
    return frozen ? 1 : loopAlpha
  }

  protected openMenu(): void {
    super.openMenu()
    this.syncPause()
  }

  protected closeMenu(): void {
    super.closeMenu()
    this.syncPause()
  }

  private syncPause(): void {
    if (!this.net) return
    const other = [...this.remotePaused.values()]
    const paused = this.menuOpen || other.length > 0
    const name = this.menuOpen ? this.local.name : (other[0] ?? '')
    this.net.broadcast({ t: 'match-paused', paused, name })
    if (paused && !this.menuOpen && name && !this.announcedPause) {
      this.announcedPause = true
      this.hud.banner(`${name} ha pausado`, ['La partida está congelada.'], 'info')
    }
    if (!paused) this.announcedPause = false
  }

  protected onEventsConsumed(): void {
    this.eventCursor = 0
  }

  private replicate(): void {
    const net = this.net!
    const world = this.world
    for (let i = this.eventCursor; i < world.events.length; i++) this.outbox.push(world.events[i])
    this.eventCursor = world.events.length

    for (const pid of net.remotePlayerIds()) {
      const p = world.playerById(pid)
      if (!p) continue
      const peers = p.offer === 'chest' ? world.chestPeers(pid) : []
      const sig = choiceSig(p.choices, peers)
      if (this.sentChoices.get(pid) === sig) continue
      this.sentChoices.set(pid, sig)
      net.send(pid, { t: 'choices', choices: p.choices, level: world.level, mode: p.offer ?? 'level', peers })
    }

    if (++this.replicateTicks % SNAPSHOT_EVERY !== 0) return
    for (const pid of net.remotePlayerIds()) {
      const p = world.playerById(pid)
      if (!p) continue
      net.send(pid, encodeSnapshot(world, p))
      const list = eventsFor(this.outbox, p)
      if (list.length) net.send(pid, { t: 'events', list })
    }
    this.outbox.length = 0
  }

  // ------------------------------------------------------------------ flow

  protected menuActions(): MenuAction[] {
    if (this.net) {
      return [
        { label: 'Continuar', hint: 'Esc', primary: true, run: () => this.closeMenu() },
        this.settingsAction(),
        { label: 'Reiniciar', run: () => this.restart() },
        { label: 'Terminar partida', run: () => this.exitToMenu() }
      ]
    }
    return [
      { label: 'Continuar', hint: 'Esc', primary: true, run: () => this.closeMenu() },
      this.settingsAction(),
      { label: 'Reiniciar', run: () => this.restart() },
      { label: 'Menú principal', run: () => this.exitToMenu() }
    ]
  }

  protected finaleActions(): MenuAction[] | null {
    if (this.net && this.localId !== HOST_PLAYER_ID) return null
    return [
      { label: 'Modo infinito', primary: true, run: () => this.world.continueEndless() },
      { label: 'Cobrar la victoria', run: () => this.world.claimVictory() }
    ]
  }

  protected leave(): void {
    this.net?.close()
  }

  private finish(): void {
    if (this.ended) return
    const world = this.world
    const info: GameOverInfo = {
      victory: world.state === 'victory',
      time: world.timeBank + world.time,
      kills: world.kills,
      level: world.level,
      gold: world.goldEarned(),
      bosses: world.bossesDefeated,
      players: world.players.map((p) => ({ id: p.id, kills: p.kills, damage: p.damageDealt }))
    }
    this.net?.broadcast({ t: 'game-over', info })
    const actions: MenuAction[] = this.net
      ? [
          { label: 'Reintentar', hint: 'R', primary: true, run: () => this.restart() },
          { label: 'Volver al menú', run: () => this.exitToMenu() }
        ]
      : [
          { label: 'Reintentar', hint: 'R', primary: true, run: () => this.restart() },
          { label: 'Menú principal', run: () => this.exitToMenu() }
        ]
    this.awardRun(info, actions)
  }

  private restart(): void {
    this.saveProgress()
    this.resetRunCredit()
    this.cancelPendingResult()
    this.announcedPause = false
    this.remotePaused.clear()
    this.sentChoices.clear()
    this.outbox.length = 0
    this.eventCursor = 0
    this.levelUp.hide()
    this.gameOver.hide()
    this.renderer.reset()
    this.world = HostSession.createWorld(this.deps, this.opts)
    this.closeMenu()
    this.net?.broadcast({ t: 'restart', seed: this.world.seed })
  }

  private debugKeys(): void {
    const input = this.deps.input
    const world = this.world
    const p = this.local
    if (input.consumePress('F1')) world.addXp(world.xpToNext - world.xp)
    if (input.consumePress('F2')) {
      const type = world.time > 300 ? EnemyType.KitsuneBoss : EnemyType.OniBoss
      world.enemies.spawn(type, p.x + SPAWN_RADIUS * 0.7, p.y, 1, 1, false, EnemyMode.Boss)
      world.events.push({ e: 'boss', enemyType: type })
    }
    if (input.consumePress('F3')) {
      world.godMode = !world.godMode
      this.hud.banner(world.godMode ? 'MODO DIOS: ON' : 'MODO DIOS: OFF')
    }
    if (input.consumePress('F4')) {
      for (let k = 0; k < 300; k++) {
        const a = Math.random() * Math.PI * 2
        const d = SPAWN_RADIUS * (0.6 + Math.random() * 0.4)
        world.enemies.spawn(EnemyType.Imp, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1, 1, false, EnemyMode.Chase)
      }
    }
    if (input.consumePress('F6')) openChest(world, p)
  }
}

function choiceSig(choices: UpgradeChoice[] | null, peers: ChestPeerView[]): string {
  const mine = choices?.map((c) => `${c.kind}/${c.id}/${c.into ?? ''}/${c.rarity ?? ''}`).join(',') ?? ''
  const side = peers.map((p) => `${p.playerId}:${p.pick}:${p.status}:${p.choices.map((c) => c.into ?? c.id).join(',')}`).join(';')
  return `${mine}#${side}`
}

/** Events relevant to one client: nearby visuals only, with damage numbers capped. */
function eventsFor(events: readonly GameEvent[], viewer: Player): GameEvent[] {
  const out: GameEvent[] = []
  let damage = 0
  for (const ev of events) {
    if ('x' in ev && Math.abs(ev.x - viewer.x) + Math.abs(ev.y - viewer.y) > EVENT_RANGE) continue
    if (ev.e === 'damage' && damage++ >= MAX_DAMAGE_EVENTS && !ev.crit) continue
    out.push(ev)
  }
  return out
}
