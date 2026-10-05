import type { Application } from 'pixi.js'
import { SIM_DT } from '@shared/constants'
import type { ChestPeerView, GameOverInfo, PlayerId, UpgradeChoice } from '@shared/protocol'
import { noteCharacterRun, type SaveData } from '@shared/save'
import type { Sfx } from '@/audio/Sfx'
import { GameLoop } from '@/core/GameLoop'
import type { Input } from '@/core/Input'
import { GameRenderer } from '@/render/GameRenderer'
import type { GameTextures } from '@/render/textures'
import { Hud } from '@/ui/Hud'
import { LevelUpOverlay } from '@/ui/LevelUpOverlay'
import { GameOverOverlay, PauseOverlay, type MenuAction } from '@/ui/Overlays'
import { pauseSheet } from '@/ui/PauseSheet'
import { settingsPanel } from '@/ui/screens/Settings'
import { accountLevel, accountXpForRun } from '@shared/account'
import { battlePassXpForRun, battlePassXpSoFar, grantBattlePassXp, passLevel } from '../data/battlePass'
import { ENEMIES } from '../data/enemies'
import { WEAPONS } from '../data/weapons'
import type { World } from '../sim/World'

export interface SessionDeps {
  app: Application
  textures: GameTextures
  sfx: Sfx
  input: Input
  save: SaveData
  persist: (save: SaveData) => Promise<void>
  /** Called once the session has torn itself down and the menu should come back. */
  onExit: () => void
  debug: boolean
}

/** Presentation shared by every kind of run: renderer, HUD, overlays and the frame loop. */
export abstract class SessionBase {
  protected readonly renderer: GameRenderer
  protected readonly hud: Hud
  protected readonly levelUp: LevelUpOverlay
  protected readonly pause: PauseOverlay
  protected readonly gameOver: GameOverOverlay
  protected readonly loop: GameLoop
  protected menuOpen = false
  protected ended = false
  private settingsOpen = false
  private finaleShown = false
  private destroyed = false
  /** Bumped when a run ends or restarts, so a late results screen cannot cover the next run. */
  private resultToken = 0
  /** Rewards already written for this run, so a later save only adds what is new. */
  private creditedGold = 0
  private creditedXp = 0
  private creditedKills = 0
  private creditedBosses = 0
  private grantedPassXp = 0
  private passAtRunStart = -1
  private creditedAccountXp = 0
  private grantedAccountXp = 0
  private accountAtRunStart = -1
  private creditedTime = 0
  private runNoted = false
  private bankClock = 0

  protected constructor(
    protected readonly deps: SessionDeps,
    protected world: World,
    protected readonly localId: PlayerId
  ) {
    const ui = document.getElementById('ui')!
    this.renderer = new GameRenderer(deps.app, deps.textures, deps.sfx, deps.save.settings)
    this.hud = new Hud(ui, deps.debug)
    this.levelUp = new LevelUpOverlay(ui)
    this.pause = new PauseOverlay(ui)
    this.gameOver = new GameOverOverlay(ui)
    this.loop = new GameLoop(
      SIM_DT,
      (dt) => this.tick(dt),
      (alpha, frame) => this.frame(alpha, frame)
    )
  }

  /** Solo runs freeze the world while a menu is open; co-op runs keep going. */
  protected abstract get pausesWhenMenuOpen(): boolean
  protected abstract update(dt: number): void
  protected abstract interpolation(loopAlpha: number): number
  protected abstract menuActions(): MenuAction[]
  protected abstract leave(): void
  /** Buttons for the 20-minute choice. Null means this peer waits for the host. */
  protected abstract finaleActions(): MenuAction[] | null

  start(): void {
    this.loop.start()
  }

  destroy(): void {
    if (this.destroyed) return
    this.saveProgress()
    this.destroyed = true
    this.loop.stop()
    this.renderer.destroy()
    this.hud.destroy()
    this.levelUp.destroy()
    this.pause.destroy()
    this.gameOver.destroy()
  }

  protected exitToMenu(): void {
    this.leave()
    this.destroy()
    this.deps.onExit()
  }

  protected get local() {
    return this.world.playerById(this.localId)!
  }

  private tick(dt: number): void {
    const input = this.deps.input
    if (input.consumePress('Escape') || input.consumePress('KeyP')) {
      if (this.settingsOpen) this.openMenu()
      else if (this.menuOpen) this.closeMenu()
      else if (!this.ended && !this.levelUp.visible) this.openMenu()
    }
    this.update(dt)
    input.clearPresses()
  }

  private frame(alpha: number, frameSeconds: number): void {
    const world = this.world
    for (const ev of world.events) {
      if (ev.e === 'discover' && ev.playerId === this.localId) this.unlockWeapon(ev.weaponId)
      else if (ev.e === 'chest' && ev.playerId === this.localId) this.hud.banner('¡PRESTIGIO!', ev.lines, 'chest')
      else if (ev.e === 'evolution') {
        const who = ev.playerId === this.localId ? '' : `${world.playerById(ev.playerId)?.name ?? ''}: `
        this.hud.banner('¡EVOLUCIÓN!', [who + WEAPONS[ev.weaponId].name], 'evolution')
      } else if (ev.e === 'boss') this.hud.banner(ev.mini ? '¡MINIJEFE!' : '¡SE ACERCA UN JEFE!', [ENEMIES[ev.enemyType].name], 'boss')
      else if (ev.e === 'endless') this.hud.banner('MODO INFINITO', ['La horda no va a parar.'], 'boss')
      else if (ev.e === 'portal') this.hud.banner('PORTAL', ['Entra para el siguiente mundo, o quédate. La horda crecerá cada vez más rápido.'], 'chest')
      else if (ev.e === 'world') this.hud.banner(ev.world === 0 ? 'NOCHE DE HANABI' : 'CENIZA CARMESÍ', ['Nivel, armas y pasivas vuelven a cero. Este mundo es más duro.'], 'boss')
      else if (ev.e === 'player-down' && world.players.length > 1) {
        const p = world.playerById(ev.playerId)
        if (p && !p.disconnected) this.hud.banner(`${p.name} ha caído`, ['¡Quédate a su lado para revivirle!'], 'boss')
      }
    }
    this.renderer.handleEvents(world, world.events, this.localId)
    world.events.length = 0
    this.onEventsConsumed()

    this.renderer.render(world, this.interpolation(alpha), frameSeconds, this.localId)
    this.noteSeenEnemies()
    this.noteLoadoutDiscoveries()
    this.hud.setWaiting(world.state === 'levelup' && !this.levelUp.visible && !this.ended)
    this.hud.update(world, this.local, frameSeconds)
    this.bankClock += frameSeconds
    if (!this.ended && !this.runNoted && this.bankClock >= 12) {
      this.bankClock = 0
      this.flushProgress(this.liveInfo(), false)
    }
    this.pause.setRunPass(this.deps.save.battlePass.xp - this.creditedXp, battlePassXpSoFar(world.timeBank + world.time, this.local.kills))
    this.pause.setRunProfile(
      this.deps.save.accountXp - this.creditedAccountXp,
      accountXpForRun(world.timeBank + world.time, this.local.kills, world.bossesDefeated)
    )
    this.presentFinale()
  }

  /** Hook for hosts that forward events to clients. */
  protected onEventsConsumed(): void {}

  protected showChoices(choices: UpgradeChoice[], level: number, pick: (index: number) => void, mode: 'level' | 'chest' = 'level', peers: ChestPeerView[] = []): void {
    this.levelUp.show(choices, level, (i) => {
      this.deps.sfx.ui()
      pick(i)
    }, mode, peers, this.local.stats.luck)
  }

  private unlockWeapon(id: string): void {
    const save = this.deps.save
    if (!id || save.unlockedWeapons.includes(id)) return
    save.unlockedWeapons.push(id)
    void this.deps.persist(save)
  }

  /** The album only reveals a weapon or passive once it has been on this player. */
  private noteLoadoutDiscoveries(): void {
    const save = this.deps.save
    const player = this.world.playerById(this.localId)
    if (!player) return
    let dirty = false
    for (const slot of player.weapons) {
      if (!slot.id || save.unlockedWeapons.includes(slot.id)) continue
      save.unlockedWeapons.push(slot.id)
      dirty = true
    }
    for (const slot of player.passives) {
      if (!slot.id || save.unlockedPassives.includes(slot.id)) continue
      save.unlockedPassives.push(slot.id)
      dirty = true
    }
    if (dirty) void this.deps.persist(save)
  }

  private noteSeenEnemies(): void {
    const fresh = this.renderer.takeSpotted()
    if (fresh.length === 0) return
    const save = this.deps.save
    let added = false
    for (const type of fresh) {
      if (save.seenEnemies.includes(type)) continue
      save.seenEnemies.push(type)
      added = true
    }
    if (added) void this.deps.persist(save)
  }

  protected openMenu(): void {
    this.menuOpen = true
    this.settingsOpen = false
    this.finaleShown = false
    this.showPauseLoadout(this.localId)
    this.syncMusic()
  }

  protected openSettings(): void {
    this.menuOpen = true
    this.settingsOpen = true
    this.finaleShown = false
    const save = this.deps.save
    this.pause.showPanel(
      'AJUSTES',
      settingsPanel(save, () => {
        this.deps.sfx.applySettings(save.settings)
        this.renderer.applySettings(save.settings)
        void window.api?.setFullscreen(save.settings.fullscreen)
        void this.deps.persist(save)
      }),
      { label: 'Volver', hint: 'Esc', primary: true, run: () => this.openMenu() },
      this.local.stats.luck
    )
  }

  private showPauseLoadout(focusId: PlayerId): void {
    this.pause.showLoadout(
      pauseSheet(this.world.players, focusId, this.localId, () => {
        this.deps.sfx.ui()
        requestAnimationFrame(() => this.pause.refit())
      }, (id) => this.showPauseLoadout(id)),
      this.menuActions(),
      (this.world.players.find((p) => p.id === focusId) ?? this.local).stats.luck
    )
  }

  protected closeMenu(): void {
    this.menuOpen = false
    this.settingsOpen = false
    this.pause.hide()
    this.syncMusic()
  }

  private syncMusic(): void {
    this.deps.sfx.duckMusic(this.menuOpen || this.finaleShown)
  }

  protected settingsAction(): MenuAction {
    return { label: 'Ajustes', run: () => this.openSettings() }
  }

  private presentFinale(): void {
    const choosing = this.world.state === 'finale' && !this.ended && !this.menuOpen
    if (!choosing) {
      if (this.finaleShown) {
        this.finaleShown = false
        if (!this.menuOpen) this.pause.hide()
        this.syncMusic()
      }
      return
    }
    if (this.finaleShown) return
    this.finaleShown = true
    this.syncMusic()
    const actions = this.finaleActions()
    if (actions) {
      this.pause.show(actions, '20 MINUTOS', 'Puedes cobrar la victoria o seguir en infinito. La horda seguirá creciendo.', this.local.stats.luck)
    } else {
      this.pause.show([], '20 MINUTOS', 'El anfitrión elige si la noche continúa.', this.local.stats.luck)
    }
  }

  /** Drops a results screen that has not appeared yet, or one already on screen. */
  protected cancelPendingResult(): void {
    this.resultToken++
    this.ended = false
  }

  /**
   * Writes gold, battle-pass XP, kills and bosses earned so far.
   * Safe to call more than once: only the part not yet saved is added.
   */
  saveProgress(): void {
    if (this.destroyed) return
    this.flushProgress(this.liveInfo(), true)
  }

  /** Clears the per-run ledger after the rewards were committed and a new run begins. */
  protected resetRunCredit(): void {
    this.creditedGold = 0
    this.creditedXp = 0
    this.creditedKills = 0
    this.creditedBosses = 0
    this.grantedPassXp = 0
    this.passAtRunStart = -1
    this.creditedAccountXp = 0
    this.grantedAccountXp = 0
    this.accountAtRunStart = -1
    this.creditedTime = 0
    this.runNoted = false
    this.bankClock = 0
  }

  private liveInfo(): GameOverInfo {
    const world = this.world
    return {
      victory: false,
      time: world.timeBank + world.time,
      kills: world.kills,
      level: world.level,
      gold: world.goldEarned(),
      bosses: world.bossesDefeated,
      players: world.players.map((p) => ({ id: p.id, kills: p.kills, damage: p.damageDealt }))
    }
  }

  private flushProgress(info: GameOverInfo, commit: boolean): {
    gained: number
    oldLevel: number
    newLevel: number
    accountGained: number
    accountOld: number
    accountNew: number
  } {
    const save = this.deps.save
    if (this.passAtRunStart < 0) this.passAtRunStart = passLevel(save.battlePass.xp)
    if (this.accountAtRunStart < 0) this.accountAtRunStart = accountLevel(save.accountXp)
    const localKills = info.players.find((p) => p.id === this.localId)?.kills ?? 0
    const xp = battlePassXpForRun(info, localKills)
    const dGold = Math.max(0, Math.floor(info.gold) - this.creditedGold)
    const dXp = Math.max(0, xp - this.creditedXp)
    const dKills = Math.max(0, localKills - this.creditedKills)
    const dBosses = Math.max(0, (info.bosses ?? 0) - this.creditedBosses)
    let dirty = false
    if (dGold) {
      save.gold += dGold
      this.creditedGold += dGold
      dirty = true
    }
    if (dXp) {
      grantBattlePassXp(save, dXp)
      this.creditedXp += dXp
      this.grantedPassXp += dXp
      dirty = true
    }
    if (dKills) {
      save.stats.totalKills += dKills
      this.creditedKills += dKills
      dirty = true
    }
    if (dBosses) {
      save.stats.bossesDefeated += dBosses
      this.creditedBosses += dBosses
      dirty = true
    }
    const best = Math.floor(info.time)
    if (best > save.stats.bestSurvivalSeconds) {
      save.stats.bestSurvivalSeconds = best
      dirty = true
    }
    const dTime = Math.max(0, best - this.creditedTime)
    if (dTime) {
      save.stats.timePlayed += dTime
      this.creditedTime += dTime
      dirty = true
    }
    const accountXp = accountXpForRun(info.time, localKills, info.bosses ?? 0)
    const dAccount = Math.max(0, accountXp - this.creditedAccountXp)
    if (dAccount) {
      save.accountXp += dAccount
      this.creditedAccountXp += dAccount
      this.grantedAccountXp += dAccount
      dirty = true
    }
    const player = this.world.playerById(this.localId)
    if (player) {
      for (const w of player.weapons) {
        if (save.unlockedWeapons.includes(w.id)) continue
        save.unlockedWeapons.push(w.id)
        dirty = true
      }
      for (const slot of player.passives) {
        if (save.unlockedPassives.includes(slot.id)) continue
        save.unlockedPassives.push(slot.id)
        dirty = true
      }
    }
    if (commit && !this.runNoted) {
      const played = info.time >= 1 || info.gold > 0 || localKills > 0 || (info.bosses ?? 0) > 0
      if (played && player) {
        save.stats.totalRuns++
        noteCharacterRun(save, player.character.id, { time: info.time, kills: localKills, bosses: info.bosses ?? 0 })
        dirty = true
      }
      this.runNoted = true
    }
    if (dirty) void this.deps.persist(save)
    return {
      gained: this.grantedPassXp,
      oldLevel: this.passAtRunStart,
      newLevel: passLevel(save.battlePass.xp),
      accountGained: this.grantedAccountXp,
      accountOld: this.accountAtRunStart,
      accountNew: accountLevel(save.accountXp)
    }
  }

  /** Credits the run to the local save and shows the results screen. */
  protected awardRun(info: GameOverInfo, actions: MenuAction[]): void {
    const token = ++this.resultToken
    const pass = this.flushProgress(info, true)
    this.ended = true

    if (info.victory) this.deps.sfx.chest()
    else this.deps.sfx.defeat()
    this.renderer.screenFlash(info.victory ? 0.8 : 0.4)
    const mine = info.players.find((p) => p.id === this.localId)
    setTimeout(() => {
      if (this.destroyed || token !== this.resultToken) return
      this.levelUp.hide()
      this.closeMenu()
      this.gameOver.show(
        {
          victory: info.victory,
          time: info.time,
          kills: info.kills,
          level: info.level,
          gold: info.gold,
          damage: mine?.damage ?? 0,
          coop: info.players.length > 1,
          passXp: pass.gained,
          passLevels: pass.newLevel - pass.oldLevel,
          accountXp: pass.accountGained,
          accountLevels: Math.max(0, pass.accountNew - pass.accountOld),
          accountLevel: pass.accountNew
        },
        actions
      )
    }, 900)
  }

  protected showDisconnected(reason: string): void {
    if (this.ended) return
    this.saveProgress()
    this.ended = true
    this.levelUp.hide()
    this.closeMenu()
    this.gameOver.showMessage('CONEXIÓN PERDIDA', reason, [{ label: 'Volver al menú', primary: true, run: () => this.exitToMenu() }])
  }
}
