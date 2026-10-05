import type { Application } from 'pixi.js'
import type { LobbyPlayer } from '@shared/protocol'
import type { SaveData } from '@shared/save'
import type { Sfx } from './audio/Sfx'
import type { Input } from './core/Input'
import { ClientSession } from './game/session/ClientSession'
import { HostSession, type HostOptions } from './game/session/HostSession'
import type { SessionBase, SessionDeps } from './game/session/SessionBase'
import { ClientNet } from './net/ClientNet'
import type { HostNet } from './net/HostNet'
import { FriendPresence, type RoomInvite } from './net/friends'
import { joinOnline } from './net/peer'
import { resolveStarter } from './game/data/characters'
import { loadoutFromSave } from './game/data/cosmetics'
import { el } from './ui/dom'
import { MenuBackdrop } from './render/MenuBackdrop'
import type { GameTextures } from './render/textures'
import { characterSelect, isUnlocked } from './ui/screens/CharacterSelect'
import { coopMenu } from './ui/screens/Coop'
import { clientLobby, hostLobby, type Invite } from './ui/screens/Lobby'
import { mainMenu } from './ui/screens/MainMenu'
import { album } from './ui/screens/Album'
import { battlePass } from './ui/screens/BattlePass'
import { boutique } from './ui/screens/Boutique'
import { settings } from './ui/screens/Settings'
import { profile } from './ui/screens/Profile'
import { skillTree } from './ui/screens/SkillTree'

export interface AppDeps {
  app: Application
  textures: GameTextures
  sfx: Sfx
  input: Input
  save: SaveData
  debug: boolean
}

/** Top-level flow: menu screens over an animated backdrop, and game sessions. */
export class App {
  readonly save: SaveData
  readonly textures: GameTextures
  readonly sfx: Sfx
  private readonly ui = document.getElementById('ui')!
  private readonly backdrop: MenuBackdrop
  private screen: HTMLElement | null = null
  private session: SessionBase | null = null
  private inviteCard: HTMLElement | null = null
  private readonly friends: FriendPresence

  constructor(private readonly deps: AppDeps) {
    this.save = deps.save
    this.textures = deps.textures
    this.sfx = deps.sfx
    this.backdrop = new MenuBackdrop(deps.app, deps.textures)
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || this.session || !this.screen) return
      this.screen.querySelector<HTMLButtonElement>('.back-btn')?.click()
    })
    this.friends = new FriendPresence(() => this.save.friendCode, (invite) => this.showInvite(invite))
    this.friends.start()
    window.addEventListener('beforeunload', () => {
      if (!this.session) return
      this.session.saveProgress()
      window.api?.flushSave(JSON.parse(JSON.stringify(this.save)) as SaveData, ++this.saveGen)
    })
  }

  /** Sends the room code to a friend who is in the menus. */
  inviteFriend(friendCode: string, room: string): Promise<void> {
    return this.friends.invite(friendCode, {
      from: this.save.settings.playerName,
      fromCode: this.save.friendCode,
      room
    })
  }

  private saveGen = 0

  persist(): Promise<void> {
    const gen = ++this.saveGen
    const copy = JSON.parse(JSON.stringify(this.save)) as SaveData
    return window.api?.writeSave(copy, gen) ?? Promise.resolve()
  }

  applySettings(): void {
    this.sfx.applySettings(this.save.settings)
    void window.api?.setFullscreen(this.save.settings.fullscreen)
  }

  /** Drops the friend listener and opens it again with the current friend code. */
  restartPresence(): void {
    this.friends.stop()
    this.friends.start()
  }

  private show(screen: HTMLElement): void {
    this.screen?.remove()
    this.screen = screen
    this.ui.append(screen)
    this.backdrop.show()
    if (!this.session) this.friends.start()
  }

  mainMenu(): void {
    this.sfx.musicMenu()
    this.show(mainMenu(this))
  }

  characterSelect(): void {
    this.show(characterSelect(this))
  }

  profile(): void {
    this.show(profile(this))
  }

  skills(back: 'menu' | 'profile' = 'menu'): void {
    this.show(skillTree(this, back))
  }

  boutique(): void {
    this.show(boutique(this))
  }

  battlePass(): void {
    this.show(battlePass(this))
  }

  album(): void {
    this.show(album(this))
  }

  settings(): void {
    this.show(settings(this))
  }

  coopMenu(error = ''): void {
    this.show(coopMenu(this, error))
  }

  hostLobby(net: HostNet, invite: Invite): void {
    this.show(hostLobby(this, net, invite))
  }

  clientLobby(net: ClientNet): void {
    this.show(clientLobby(this, net))
  }

  private sessionDeps(): SessionDeps {
    return {
      app: this.deps.app,
      textures: this.deps.textures,
      sfx: this.deps.sfx,
      input: this.deps.input,
      save: this.save,
      persist: () => this.persist(),
      debug: this.deps.debug,
      onExit: () => {
        this.session = null
        this.mainMenu()
      }
    }
  }

  private run(session: SessionBase): void {
    this.sfx.musicMatch()
    this.dismissInvite()
    this.friends.stop()
    this.screen?.remove()
    this.screen = null
    this.backdrop.hide()
    this.deps.input.clearPresses()
    this.session = session
    session.start()
  }

  private showInvite(invite: RoomInvite): void {
    if (this.session) return
    this.dismissInvite()
    const card = el('div', 'friend-invite')
    card.append(
      el('div', 'friend-invite-kicker', 'INVITACIÓN'),
      el('div', 'friend-invite-name', `${invite.from} te invita a una sala`),
      el('p', 'friend-invite-code', `Código ${invite.room}`)
    )
    const row = el('div', 'friend-invite-actions')
    const accept = el('button', 'btn primary', 'Aceptar')
    const decline = el('button', 'btn', 'Ahora no')
    accept.addEventListener('click', () => {
      this.dismissInvite()
      void this.acceptInvite(invite.room)
    })
    decline.addEventListener('click', () => this.dismissInvite())
    row.append(accept, decline)
    card.append(row)
    this.inviteCard = card
    this.ui.append(card)
    this.sfx.ui()
  }

  private dismissInvite(): void {
    this.inviteCard?.remove()
    this.inviteCard = null
  }

  private async acceptInvite(room: string): Promise<void> {
    const characterId = isUnlocked(this, this.save.lastCharacter) ? this.save.lastCharacter : 'sakura'
    try {
      const transport = await joinOnline(room)
      const net = await ClientNet.handshake(transport, {
        name: this.save.settings.playerName,
        characterId,
        weaponId: resolveStarter(characterId, this.save.starterWeapons[characterId]),
        cosmetics: loadoutFromSave(this.save),
        metaUpgrades: this.save.metaUpgrades
      })
      this.clientLobby(net)
    } catch (err) {
      this.coopMenu((err as Error).message)
    }
  }

  startSolo(characterId: string, weaponOrDebug?: string | Partial<HostOptions>, debug: Partial<HostOptions> = {}): void {
    const weaponId = typeof weaponOrDebug === 'string' ? weaponOrDebug : undefined
    const opts = typeof weaponOrDebug === 'object' && weaponOrDebug ? weaponOrDebug : debug
    this.run(new HostSession(this.sessionDeps(), { characterId, weaponId, ...opts }))
  }

  startCoopHost(net: HostNet, seed: number): void {
    this.run(new HostSession(this.sessionDeps(), { characterId: net.lobby[0].characterId, net, seed }))
  }

  startCoopClient(net: ClientNet, players: LobbyPlayer[]): void {
    this.run(new ClientSession(this.sessionDeps(), net, players))
  }
}
