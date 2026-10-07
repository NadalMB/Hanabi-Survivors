import { MAX_ENEMIES, MAX_PICKUPS, MAX_PROJECTILES } from '@shared/constants'
import type { CosmeticLoadout } from '@shared/save'
import type { ChestPeerView, GameEvent, PlayerId, UpgradeChoice } from '@shared/protocol'
import { Rng } from '@/core/Rng'
import { SpatialHash } from '@/core/SpatialHash'
import type { StatMods } from '../data/stats'
import { SpawnDirector } from '../systems/director'
import { updateEnemies } from '../systems/enemies'
import { spawnPickup, updatePickups } from '../systems/pickups'
import { downPlayer, updatePlayers } from '../systems/players'
import { updateProjectiles } from '../systems/projectiles'
import {
  applyChoice,
  CHEST_CONSOLATION_GOLD,
  chestChoices,
  generateChoices,
  isChestLevelOffer,
  isChestUiOffer,
  rollSharedChest
} from '../systems/upgrades'
import { updateWeapons } from '../systems/weapons'
import { WORLD_COUNT } from '../data/worlds'
import { CELL_SIZE, RUN_DURATION_SECONDS, xpForLevel } from './config'
import { EnemyPool } from './EnemyPool'
import { PickupPool, PickupType } from './PickupPool'
import { Player } from './Player'
import { ProjectilePool } from './ProjectilePool'

export interface WorldPlayerInit {
  id: PlayerId
  name: string
  characterId: string
  weaponId?: string
  meta: StatMods
  loadout?: CosmeticLoadout
}

export interface WorldOptions {
  seed: number
  players: WorldPlayerInit[]
  /** 1 until this save has entered the second world. Gates the musician's weapons. */
  catalog?: number
}

export type WorldState = 'running' | 'levelup' | 'gameover' | 'victory' | 'finale'

/**
 * Complete, renderer-agnostic game state. Advanced only through `update(dt)`
 * with a fixed timestep, so the host can run it authoritatively in co-op.
 */
export class World {
  readonly rng: Rng
  readonly players: Player[]
  readonly enemies = new EnemyPool(MAX_ENEMIES)
  readonly projectiles = new ProjectilePool(MAX_PROJECTILES)
  readonly pickups = new PickupPool(MAX_PICKUPS)
  readonly grid = new SpatialHash(CELL_SIZE, 12, MAX_ENEMIES)
  readonly director = new SpawnDirector()
  /** Accumulates until the presentation layer consumes and clears it. */
  readonly events: GameEvent[] = []

  state: WorldState = 'running'
  /** Clock of the current world. Resets when a portal is taken. */
  time = 0
  /** Time already spent in earlier worlds, so rewards still count the whole run. */
  timeBank = 0
  /** 0 = Noche de Hanabi, 1 = Ceniza Carmesí. */
  realm = 0
  /** Worlds this save has opened. 2 lets the guitar and flute appear. */
  catalog = 1
  portalOpen = false
  portalOpenedAt = 0
  /** Multiplier already applied to living enemies since the portal opened. */
  pressure = 1
  tick = 0
  xp = 0
  level = 1
  xpToNext = xpForLevel(1)
  kills = 0
  gold = 0
  bossesDefeated = 0
  maxEnemyRadius = 24
  godMode = false
  /** Album sandbox: no director, no rewards, no 20-minute finale. */
  practice = false
  /** Set when the team chooses to keep playing after the 20 minute night. */
  endless = false
  /** One chest on the ground opens a different offer for every living player. */
  sharedChest: { playerId: PlayerId; choices: UpgradeChoice[]; pick: number | null }[] | null = null
  /** World position of the shared chest currently being resolved. */
  sharedChestOrigin: { x: number; y: number } | null = null
  /** Extra shared chests picked up before the current one is resolved. */
  queuedChests = 0
  /** World positions for queued shared chests. */
  readonly queuedChestPos: { x: number; y: number }[] = []
  readonly seed: number

  constructor(opts: WorldOptions) {
    this.seed = opts.seed >>> 0
    this.catalog = opts.catalog && opts.catalog >= 2 ? 2 : 1
    this.rng = new Rng(this.seed)
    const n = opts.players.length
    this.players = opts.players.map((p, i) => {
      const player = new Player(p.id, i, p.name, p.characterId, p.meta, p.loadout, p.weaponId)
      player.x = player.prevX = (i - (n - 1) / 2) * 48
      return player
    })
  }

  playerById(id: PlayerId): Player | undefined {
    return this.players.find((p) => p.id === id)
  }

  alivePlayerCount(): number {
    let n = 0
    for (const p of this.players) if (p.alive) n++
    return n
  }

  randomAlivePlayer(): Player | undefined {
    const alive = this.players.filter((p) => p.alive)
    return alive.length ? this.rng.pick(alive) : undefined
  }

  setInput(id: PlayerId, moveX: number, moveY: number, seq = 0): void {
    const p = this.playerById(id)
    if (!p) return
    const len = Math.hypot(moveX, moveY)
    const k = len > 1 ? 1 / len : 1
    p.moveX = moveX * k
    p.moveY = moveY * k
    p.lastInputSeq = seq
  }

  update(dt: number): void {
    if (this.state !== 'running') return
    this.tick++
    this.time += dt
    this.storePrevious()

    updatePlayers(this, dt)
    this.director.update(this, dt)
    const e = this.enemies
    this.grid.build(e.x, e.y, e.alive, e.count)
    updateEnemies(this, dt)
    updateWeapons(this, dt)
    updateProjectiles(this, dt)
    updatePickups(this, dt)

    e.compact()
    this.projectiles.compact()
    this.pickups.compact()

    this.resolveLevelUps()
    if (this.alivePlayerCount() === 0) this.state = 'gameover'
    else if (!this.practice && !this.endless && this.time >= RUN_DURATION_SECONDS && this.state === 'running') {
      this.time = RUN_DURATION_SECONDS
      this.state = 'finale'
    }
  }

  /** Keep the night going with no time limit. Difficulty keeps climbing. */
  continueEndless(): void {
    if (this.state !== 'finale') return
    this.endless = true
    this.state = 'running'
    this.events.push({ e: 'endless' })
  }

  /** The minute-10 guardian fell. The portal stays until someone walks into it. */
  openPortal(x: number, y: number): void {
    if (this.portalOpen || this.realm >= WORLD_COUNT - 1) return
    this.portalOpen = true
    this.portalOpenedAt = this.time
    this.pressure = 1
    spawnPickup(this, PickupType.Portal, x, y, 0, 0)
    this.events.push({ e: 'portal' })
  }

  /** Step into the next world: clock, hordes and the whole build start over. */
  enterNext(): void {
    if (!this.portalOpen || this.realm >= WORLD_COUNT - 1) return
    this.timeBank += this.time
    this.time = 0
    this.realm += 1
    this.catalog = Math.max(this.catalog, this.realm + 1)
    this.portalOpen = false
    this.portalOpenedAt = 0
    this.pressure = 1
    this.endless = false
    this.level = 1
    this.xp = 0
    this.xpToNext = xpForLevel(1)
    this.sharedChest = null
    this.sharedChestOrigin = null
    this.queuedChests = 0
    this.queuedChestPos.length = 0
    if (this.state !== 'gameover' && this.state !== 'victory') this.state = 'running'
    for (const p of this.players) p.resetBuild()
    const wipe = (pool: { count: number; alive: Uint8Array; compact: () => void }): void => {
      for (let i = 0; i < pool.count; i++) pool.alive[i] = 0
      pool.compact()
    }
    wipe(this.enemies)
    wipe(this.projectiles)
    wipe(this.pickups)
    this.director.reset()
    this.events.push({ e: 'world', world: this.realm })
  }

  /** Cash out the 20 minute clear. */
  claimVictory(): void {
    if (this.state !== 'finale') return
    this.state = 'victory'
  }

  private storePrevious(): void {
    for (const p of this.players) {
      p.prevX = p.x
      p.prevY = p.y
    }
    const e = this.enemies
    e.prevX.set(e.x.subarray(0, e.count))
    e.prevY.set(e.y.subarray(0, e.count))
    const pr = this.projectiles
    pr.prevX.set(pr.x.subarray(0, pr.count))
    pr.prevY.set(pr.y.subarray(0, pr.count))
    const pk = this.pickups
    pk.prevX.set(pk.x.subarray(0, pk.count))
    pk.prevY.set(pk.y.subarray(0, pk.count))
  }

  addXp(amount: number): void {
    this.xp += amount
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = xpForLevel(this.level)
      for (const p of this.players) if (p.alive) p.pendingLevelUps++
      this.events.push({ e: 'level-up', level: this.level })
    }
  }

  /** A full build has nothing left to pick, so the level pays out gold and the run keeps going. */
  private drainOrOffer(p: Player): void {
    let bags = 0
    while (p.pendingLevelUps > 0 && !p.choices) {
      const choices = generateChoices(this, p)
      if (choices.length > 0) {
        p.choices = choices
        p.offer = 'level'
        break
      }
      bags++
      p.pendingLevelUps--
    }
    if (bags > 0) {
      this.gold += Math.round(40 * p.stats.greed) * bags
      this.events.push({ e: 'pickup', kind: PickupType.Gold, playerId: p.id, x: p.x, y: p.y })
    }
  }

  private resolveLevelUps(): void {
    for (const p of this.players) {
      if (!p.alive) {
        p.pendingLevelUps = 0
        p.pendingChests = 0
        p.awaitingChest = false
        p.choices = null
        p.offer = null
        this.skipSharedSeat(p.id)
        continue
      }
      this.offerIfIdle(p)
    }
    this.finishSharedChest()
    if (this.players.some((p) => p.choices)) this.state = 'levelup'
  }

  chooseUpgrade(playerId: PlayerId, index: number): void {
    const p = this.playerById(playerId)
    if (!p || !p.choices) return
    const skipped = index < 0
    const choice = p.choices[index]
    const offer = p.offer
    if (!skipped) {
      if (!choice) return
      applyChoice(this, p, choice)
    }
    if (offer === 'level') p.pendingLevelUps = Math.max(0, p.pendingLevelUps - 1)
    if (offer === 'chest') this.noteChestPick(p.id, skipped ? -1 : index)
    p.choices = null
    p.offer = null
    this.finishSharedChest()
    this.offerIfIdle(p)
    if (p.choices || this.players.some((pl) => pl.choices)) this.state = 'levelup'
    else if (this.state === 'levelup') this.state = 'running'
  }

  private offerIfIdle(p: Player): void {
    if (!p.alive || p.choices) return
    if (p.pendingLevelUps > 0) this.drainOrOffer(p)
    if (p.choices) return
    if (p.awaitingChest && this.sharedChest) {
      const seat = this.sharedChest.find((s) => s.playerId === p.id && s.pick === null)
      if (seat) {
        p.awaitingChest = false
        this.deliverChest(p, seat.choices)
        return
      }
    }
    if (p.pendingChests <= 0) return
    p.pendingChests--
    this.deliverChest(p, chestChoices(this, p))
  }

  /**
   * Prestige/evolution opens the chest UI. Weapon levels apply instantly with a
   * small toast. Anything else pays a flat coin consolation.
   */
  private deliverChest(p: Player, choices: UpgradeChoice[]): void {
    const choice = choices[0]
    if (isChestUiOffer(choice)) {
      p.choices = choices
      p.offer = 'chest'
      return
    }
    if (isChestLevelOffer(choice)) {
      const before = p.weapon(choice.id)?.level ?? 1
      applyChoice(this, p, choice)
      const after = p.weapon(choice.id)?.level ?? before
      const steps = Math.max(1, after - before)
      const pos = p.pendingChestPos.shift() ?? this.sharedChestOrigin ?? { x: p.x, y: p.y }
      this.events.push({
        e: 'chest-level',
        playerId: p.id,
        weaponId: choice.id,
        steps,
        level: after,
        x: pos.x,
        y: pos.y
      })
      this.noteChestPick(p.id, 0)
      this.finishSharedChest()
      this.offerIfIdle(p)
      return
    }
    p.pendingChestPos.shift()
    if (!this.practice) this.gold += CHEST_CONSOLATION_GOLD
    this.noteChestPick(p.id, -1)
    this.finishSharedChest()
    this.offerIfIdle(p)
  }

  /** Marks a co-op chest seat resolved. -1 means they took nothing. */
  private noteChestPick(id: PlayerId, pick: number): void {
    const seat = this.sharedChest?.find((s) => s.playerId === id)
    if (seat && seat.pick === null) seat.pick = pick
  }

  private skipSharedSeat(id: PlayerId): void {
    this.noteChestPick(id, -1)
  }

  /** When every living player has answered, start the next queued chest. */
  private finishSharedChest(): void {
    const round = this.sharedChest
    if (!round) return
    const pending = round.some((seat) => {
      const pl = this.playerById(seat.playerId)
      return !!pl && pl.alive && !pl.disconnected && seat.pick === null
    })
    if (pending) return
    this.sharedChest = null
    this.sharedChestOrigin = null
    for (const p of this.players) p.awaitingChest = false
    if (this.queuedChests <= 0) return
    this.queuedChests--
    const party = this.players.filter((p) => p.alive && !p.disconnected)
    const origin = this.queuedChestPos.shift() ?? { x: party[0]?.x ?? 0, y: party[0]?.y ?? 0 }
    if (party.length <= 1) {
      if (party[0]) {
        party[0].pendingChests++
        party[0].pendingChestPos.push(origin)
      }
      return
    }
    this.sharedChestOrigin = origin
    this.sharedChest = rollSharedChest(this, party)
    for (const p of party) p.awaitingChest = true
    for (const p of party) this.offerIfIdle(p)
  }

  chestPeers(viewerId: PlayerId): ChestPeerView[] {
    if (!this.sharedChest) return []
    return this.sharedChest
      .filter((seat) => seat.playerId !== viewerId)
      .map((seat) => {
        const pl = this.playerById(seat.playerId)
        let status: ChestPeerView['status'] = 'waiting'
        if (seat.pick === null) status = pl?.offer === 'chest' ? 'picking' : 'waiting'
        else status = seat.pick < 0 ? 'skipped' : 'taken'
        return { playerId: seat.playerId, name: pl?.name ?? 'Jugador', choices: seat.choices, pick: seat.pick, status }
      })
  }

  disconnectPlayer(id: PlayerId): void {
    const p = this.playerById(id)
    if (!p || p.disconnected) return
    p.disconnected = true
    if (p.alive) downPlayer(this, p)
    p.choices = null
    p.offer = null
    p.pendingLevelUps = 0
    p.pendingChests = 0
    p.awaitingChest = false
    this.skipSharedSeat(id)
    this.finishSharedChest()
    const pk = this.pickups
    for (let i = 0; i < pk.count; i++) if (pk.alive[i] && pk.owner[i] === id) pk.owner[i] = 0
    if (this.state === 'levelup' && !this.players.some((pl) => pl.choices)) this.state = 'running'
  }

  /** Gold awarded for the run, including survival and boss bonuses. */
  goldEarned(): number {
    const survival = Math.floor((this.timeBank + this.time) / 60) * 8
    const victory = this.state === 'victory' ? 250 : 0
    return Math.floor(this.gold + survival + this.bossesDefeated * 60 + victory)
  }
}
