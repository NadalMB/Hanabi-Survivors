import { MAX_PLAYERS, PROTOCOL_VERSION } from '@shared/constants'
import type { CosmeticLoadout } from '@shared/save'
import type { ClientMessage, HostMessage, LobbyPlayer, PlayerId } from '@shared/protocol'
import type { HostTransport, Packet } from './transport'

export const HOST_PLAYER_ID: PlayerId = 1

interface RemotePeer {
  peer: number
  playerId: PlayerId
  metaUpgrades: Record<string, number>
}

/**
 * Host-side session manager: lobby membership, then message routing during
 * the run. The host itself is always player 1 and has no transport peer.
 */
export class HostNet {
  readonly lobby: LobbyPlayer[]
  private readonly remotes = new Map<number, RemotePeer>()
  private nextPlayerId = HOST_PLAYER_ID + 1
  private started = false

  onLobbyChange: () => void = () => {}
  onGameMessage: (playerId: PlayerId, msg: ClientMessage) => void = () => {}
  onPlayerLeft: (playerId: PlayerId) => void = () => {}

  constructor(
    readonly transport: HostTransport,
    host: { name: string; characterId: string; weaponId?: string; cosmetics?: CosmeticLoadout }
  ) {
    this.lobby = [{ id: HOST_PLAYER_ID, name: host.name, characterId: host.characterId, weaponId: host.weaponId, ready: true, host: true, cosmetics: host.cosmetics }]
    transport.onMessage = (peer, data) => this.receive(peer, data)
    transport.onDisconnect = (peer) => this.drop(peer)
  }

  get playerCount(): number {
    return this.lobby.length
  }

  metaFor(playerId: PlayerId): Record<string, number> {
    for (const r of this.remotes.values()) if (r.playerId === playerId) return r.metaUpgrades
    return {}
  }

  setHostCharacter(characterId: string, weaponId?: string): void {
    this.lobby[0].characterId = characterId
    this.lobby[0].weaponId = weaponId
    this.broadcastLobby()
  }

  allReady(): boolean {
    return this.lobby.every((p) => p.ready)
  }

  start(seed: number): void {
    this.started = true
    this.broadcast({ t: 'start', seed, players: this.lobby })
  }

  send(playerId: PlayerId, msg: HostMessage | ArrayBuffer): void {
    for (const r of this.remotes.values()) {
      if (r.playerId === playerId) this.transport.send(r.peer, msg instanceof ArrayBuffer ? msg : JSON.stringify(msg))
    }
  }

  broadcast(msg: HostMessage): void {
    this.transport.broadcast(JSON.stringify(msg))
  }

  remotePlayerIds(): PlayerId[] {
    return [...this.remotes.values()].map((r) => r.playerId)
  }

  close(reason = 'El anfitrión cerró la partida.'): void {
    this.broadcast({ t: 'closed', reason })
    // Give the goodbye message a moment to flush before tearing the channel down.
    setTimeout(() => this.transport.close(), 150)
  }

  private receive(peer: number, data: Packet): void {
    if (typeof data !== 'string') return
    let msg: ClientMessage
    try {
      msg = JSON.parse(data) as ClientMessage
    } catch {
      return
    }
    const remote = this.remotes.get(peer)
    if (!remote) {
      if (msg.t === 'hello') this.admit(peer, msg)
      return
    }
    if (msg.t === 'lobby-update' && !this.started) {
      const entry = this.lobby.find((p) => p.id === remote.playerId)
      if (entry) {
        entry.characterId = msg.characterId
        entry.weaponId = msg.weaponId
        entry.ready = msg.ready
        this.broadcastLobby()
      }
      return
    }
    if (this.started) this.onGameMessage(remote.playerId, msg)
  }

  private admit(peer: number, hello: Extract<ClientMessage, { t: 'hello' }>): void {
    const reject = (reason: string): void => {
      this.transport.send(peer, JSON.stringify({ t: 'reject', reason } satisfies HostMessage))
      setTimeout(() => this.transport.kick(peer), 200)
    }
    if (hello.protocol !== PROTOCOL_VERSION) return reject('Versión del juego distinta a la del anfitrión.')
    if (this.started) return reject('La partida ya ha empezado.')
    if (this.lobby.length >= MAX_PLAYERS) return reject('La sala está llena.')

    const playerId = this.nextPlayerId++
    this.remotes.set(peer, { peer, playerId, metaUpgrades: hello.metaUpgrades ?? {} })
    this.lobby.push({
      id: playerId,
      name: hello.name.slice(0, 16) || `Jugador ${playerId}`,
      characterId: hello.characterId,
      weaponId: hello.weaponId,
      ready: false,
      host: false,
      cosmetics: hello.cosmetics
    })
    this.transport.send(peer, JSON.stringify({ t: 'welcome', playerId, lobby: this.lobby } satisfies HostMessage))
    this.broadcastLobby()
  }

  private drop(peer: number): void {
    const remote = this.remotes.get(peer)
    if (!remote) return
    this.remotes.delete(peer)
    if (!this.started) {
      const i = this.lobby.findIndex((p) => p.id === remote.playerId)
      if (i >= 0) this.lobby.splice(i, 1)
      this.broadcastLobby()
    } else {
      this.onPlayerLeft(remote.playerId)
    }
  }

  private broadcastLobby(): void {
    this.broadcast({ t: 'lobby', lobby: this.lobby })
    this.onLobbyChange()
  }
}
