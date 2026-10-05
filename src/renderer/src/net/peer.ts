import Peer, { type DataConnection } from 'peerjs'
import { PEER_ID_PREFIX } from '@shared/constants'
import { noop, type ClientTransport, type HostTransport, type Packet } from './transport'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CONNECT_TIMEOUT_MS = 15000

export function makeInviteCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function peerErrorMessage(err: unknown): string {
  const type = (err as { type?: string }).type
  switch (type) {
    case 'peer-unavailable':
      return 'No existe ninguna partida con ese código.'
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'No se pudo contactar con el servidor de conexión. Revisa tu conexión a Internet.'
    case 'browser-incompatible':
      return 'WebRTC no está disponible.'
    default:
      return `Error de conexión (${type ?? String(err)}).`
  }
}

class PeerHostTransport implements HostTransport {
  readonly kind = 'online'
  onConnect: (peer: number) => void = noop
  onMessage: (peer: number, data: Packet) => void = noop
  onDisconnect: (peer: number) => void = noop
  private readonly conns = new Map<number, DataConnection>()
  private nextId = 1

  constructor(private readonly peer: Peer) {
    peer.on('connection', (conn) => {
      let id = 0
      conn.on('open', () => {
        id = this.nextId++
        this.conns.set(id, conn)
        this.onConnect(id)
      })
      conn.on('data', (data) => {
        if (id) this.onMessage(id, data as Packet)
      })
      const drop = (): void => {
        if (id && this.conns.delete(id)) this.onDisconnect(id)
      }
      conn.on('close', drop)
      conn.on('error', drop)
    })
  }

  send(peer: number, data: Packet): void {
    const conn = this.conns.get(peer)
    if (conn?.open) void conn.send(data)
  }

  broadcast(data: Packet): void {
    for (const conn of this.conns.values()) if (conn.open) void conn.send(data)
  }

  kick(peer: number): void {
    this.conns.get(peer)?.close()
  }

  close(): void {
    for (const conn of this.conns.values()) conn.close()
    this.conns.clear()
    this.peer.destroy()
  }
}

/** Registers `code` on the public PeerJS broker; rejects if it is taken or unreachable. */
export function hostOnline(code: string): Promise<HostTransport> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PEER_ID_PREFIX + code, { debug: 0 })
    const timer = setTimeout(() => {
      peer.destroy()
      reject(new Error('Tiempo de espera agotado al crear la sala.'))
    }, CONNECT_TIMEOUT_MS)
    peer.once('open', () => {
      clearTimeout(timer)
      resolve(new PeerHostTransport(peer))
    })
    peer.once('error', (err) => {
      clearTimeout(timer)
      peer.destroy()
      reject(Object.assign(new Error(peerErrorMessage(err)), { type: (err as { type?: string }).type }))
    })
  })
}

class PeerClientTransport implements ClientTransport {
  onMessage: (data: Packet) => void = noop
  onClose: (reason: string) => void = noop
  private closed = false

  constructor(
    private readonly peer: Peer,
    private readonly conn: DataConnection
  ) {
    conn.on('data', (data) => this.onMessage(data as Packet))
    conn.on('close', () => this.finish('Se perdió la conexión con el anfitrión.'))
    conn.on('error', () => this.finish('Error en la conexión con el anfitrión.'))
    peer.on('disconnected', () => {
      // Signalling loss doesn't break an established data channel; keep playing.
    })
  }

  private finish(reason: string): void {
    if (this.closed) return
    this.closed = true
    this.onClose(reason)
    this.peer.destroy()
  }

  send(data: Packet): void {
    if (this.conn.open) void this.conn.send(data)
  }

  close(): void {
    this.closed = true
    this.conn.close()
    this.peer.destroy()
  }
}

export function joinOnline(code: string): Promise<ClientTransport> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({ debug: 0 })
    const fail = (message: string): void => {
      clearTimeout(timer)
      peer.destroy()
      reject(new Error(message))
    }
    const timer = setTimeout(() => fail('No se pudo conectar: tiempo de espera agotado.'), CONNECT_TIMEOUT_MS)
    peer.once('error', (err) => fail(peerErrorMessage(err)))
    peer.once('open', () => {
      const conn = peer.connect(PEER_ID_PREFIX + normalizeCode(code), { reliable: true, serialization: 'raw' })
      conn.once('open', () => {
        clearTimeout(timer)
        resolve(new PeerClientTransport(peer, conn))
      })
      conn.once('error', () => fail('No se pudo abrir el canal de datos con el anfitrión.'))
    })
  })
}
