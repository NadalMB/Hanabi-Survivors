import Peer, { type DataConnection } from 'peerjs'
import { PEER_ID_PREFIX } from '@shared/constants'

const FRIEND_PREFIX = `${PEER_ID_PREFIX}friend-`
const INVITE_TIMEOUT_MS = 8000

export interface RoomInvite {
  from: string
  fromCode: string
  room: string
}

/** Listens for friend invites while you are in the menus, and sends invites to friends who are online. */
export class FriendPresence {
  private peer: Peer | null = null
  private starting = false

  constructor(
    private readonly code: () => string,
    private readonly onInvite: (invite: RoomInvite) => void
  ) {}

  start(): void {
    if (this.peer || this.starting) return
    const id = FRIEND_PREFIX + this.code()
    this.starting = true
    const peer = new Peer(id, { debug: 0 })
    this.peer = peer
    peer.once('open', () => {
      this.starting = false
    })
    peer.once('error', () => {
      if (!this.starting) return
      this.starting = false
      if (this.peer === peer) this.peer = null
    })
    peer.on('connection', (conn) => this.accept(conn))
  }

  stop(): void {
    this.starting = false
    this.peer?.destroy()
    this.peer = null
  }

  /** Pushes a room code to a friend. Rejects if they are not in the menus right now. */
  invite(friendCode: string, invite: RoomInvite): Promise<void> {
    const peer = this.peer
    if (!peer || !peer.open) return Promise.reject(new Error('Todavía no estás en línea. Espera un momento y vuelve a intentarlo.'))
    return new Promise((resolve, reject) => {
      const conn = peer.connect(FRIEND_PREFIX + friendCode, { reliable: true })
      const timer = setTimeout(() => {
        conn.close()
        reject(new Error('Tu amigo no está conectado ahora.'))
      }, INVITE_TIMEOUT_MS)
      conn.once('open', () => {
        clearTimeout(timer)
        conn.send({ t: 'invite', ...invite })
        setTimeout(() => conn.close(), 300)
        resolve()
      })
      conn.once('error', () => {
        clearTimeout(timer)
        reject(new Error('Tu amigo no está conectado ahora.'))
      })
    })
  }

  private accept(conn: DataConnection): void {
    conn.on('data', (data) => {
      const msg = data as { t?: string; from?: string; fromCode?: string; room?: string }
      if (msg?.t !== 'invite' || typeof msg.room !== 'string' || msg.room.length < 6) return
      this.onInvite({
        from: (msg.from || 'Un amigo').slice(0, 16),
        fromCode: (msg.fromCode || '').slice(0, 6),
        room: msg.room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      })
    })
  }
}
