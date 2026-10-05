import { PROTOCOL_VERSION } from '@shared/constants'
import type { CosmeticLoadout } from '@shared/save'
import type { ClientMessage, HostMessage, LobbyPlayer, PlayerId } from '@shared/protocol'
import { isSnapshot } from './snapshot'
import type { ClientTransport } from './transport'

const WELCOME_TIMEOUT_MS = 8000

/** Client-side connection: handshake, lobby state, then game traffic. */
export class ClientNet {
  playerId: PlayerId = 0
  lobby: LobbyPlayer[] = []

  onLobby: (lobby: LobbyPlayer[]) => void = () => {}
  onStart: (seed: number, players: LobbyPlayer[]) => void = () => {}
  onMessage: (msg: HostMessage) => void = () => {}
  onSnapshot: (buf: ArrayBuffer) => void = () => {}
  onClose: (reason: string) => void = () => {}

  private constructor(private readonly transport: ClientTransport) {}

  static handshake(
    transport: ClientTransport,
    hello: { name: string; characterId: string; weaponId?: string; metaUpgrades: Record<string, number>; cosmetics?: CosmeticLoadout }
  ): Promise<ClientNet> {
    const net = new ClientNet(transport)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        transport.close()
        reject(new Error('El anfitrión no respondió.'))
      }, WELCOME_TIMEOUT_MS)
      let welcomed = false
      transport.onClose = (reason) => {
        clearTimeout(timer)
        if (welcomed) net.onClose(reason)
        else reject(new Error(reason))
      }
      transport.onMessage = (data) => {
        if (typeof data !== 'string') {
          if (welcomed && isSnapshot(data)) net.onSnapshot(data)
          return
        }
        const msg = JSON.parse(data) as HostMessage
        if (!welcomed) {
          if (msg.t === 'welcome') {
            welcomed = true
            clearTimeout(timer)
            net.playerId = msg.playerId
            net.lobby = msg.lobby
            resolve(net)
          } else if (msg.t === 'reject') {
            clearTimeout(timer)
            transport.close()
            reject(new Error(msg.reason))
          }
          return
        }
        net.dispatch(msg)
      }
      net.send({ t: 'hello', protocol: PROTOCOL_VERSION, ...hello })
    })
  }

  private dispatch(msg: HostMessage): void {
    switch (msg.t) {
      case 'lobby':
        this.lobby = msg.lobby
        this.onLobby(msg.lobby)
        return
      case 'start':
        this.onStart(msg.seed, msg.players)
        return
      case 'closed':
        this.transport.close()
        this.onClose(msg.reason)
        return
      default:
        this.onMessage(msg)
    }
  }

  send(msg: ClientMessage): void {
    this.transport.send(JSON.stringify(msg))
  }

  close(): void {
    this.transport.close()
  }
}
