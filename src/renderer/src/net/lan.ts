import { LAN_BROADCAST_ID, LAN_DEFAULT_PORT } from '@shared/constants'
import { noop, type ClientTransport, type HostTransport, type Packet } from './transport'

const CONNECT_TIMEOUT_MS = 6000

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('Tiempo de espera agotado. ¿Está el anfitrión en la misma red y el firewall lo permite?'))
    }, CONNECT_TIMEOUT_MS)
    ws.onopen = () => {
      clearTimeout(timer)
      resolve(ws)
    }
    ws.onerror = () => {
      clearTimeout(timer)
      reject(new Error('No se pudo conectar con esa dirección.'))
    }
  })
}

/** Talks to the LanHub in our own main process, which relays to/from LAN clients. */
class LanHostTransport implements HostTransport {
  readonly kind = 'lan'
  onConnect: (peer: number) => void = noop
  onMessage: (peer: number, data: Packet) => void = noop
  onDisconnect: (peer: number) => void = noop

  constructor(private readonly ws: WebSocket) {
    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => {
      if (typeof ev.data === 'string') {
        const sep = ev.data.indexOf('|')
        const id = Number(ev.data.slice(0, sep))
        const payload = ev.data.slice(sep + 1)
        if (id === 0) {
          const ctl = JSON.parse(payload) as { t: 'connect' | 'disconnect'; id: number }
          if (ctl.t === 'connect') this.onConnect(ctl.id)
          else this.onDisconnect(ctl.id)
          return
        }
        this.onMessage(id, payload)
      } else {
        const id = new DataView(ev.data).getUint16(0, true)
        this.onMessage(id, ev.data.slice(2))
      }
    }
  }

  send(peer: number, data: Packet): void {
    if (this.ws.readyState !== WebSocket.OPEN) return
    if (typeof data === 'string') {
      this.ws.send(`${peer}|${data}`)
      return
    }
    const framed = new Uint8Array(data.byteLength + 2)
    new DataView(framed.buffer).setUint16(0, peer, true)
    framed.set(new Uint8Array(data), 2)
    this.ws.send(framed.buffer)
  }

  broadcast(data: Packet): void {
    this.send(LAN_BROADCAST_ID, data)
  }

  kick(peer: number): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(`${peer}|__kick`)
  }

  close(): void {
    this.ws.close()
    void window.api?.lan.stop()
  }
}

export async function hostLan(port = LAN_DEFAULT_PORT): Promise<{ transport: HostTransport; addresses: string[]; port: number }> {
  if (!window.api) throw new Error('El modo LAN solo está disponible en la versión de escritorio.')
  const res = await window.api.lan.start(port)
  if (!res.ok) throw new Error(res.error)
  const ws = await openSocket(`ws://127.0.0.1:${res.port}/?role=host`)
  return { transport: new LanHostTransport(ws), addresses: res.addresses, port: res.port }
}

class LanClientTransport implements ClientTransport {
  onMessage: (data: Packet) => void = noop
  onClose: (reason: string) => void = noop
  private closedByUs = false

  constructor(private readonly ws: WebSocket) {
    ws.onmessage = (ev: MessageEvent<string | ArrayBuffer>) => this.onMessage(ev.data)
    ws.onclose = () => {
      if (!this.closedByUs) this.onClose('Se perdió la conexión con el anfitrión.')
    }
  }

  send(data: Packet): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(data)
  }

  close(): void {
    this.closedByUs = true
    this.ws.close()
  }
}

export async function joinLan(address: string): Promise<ClientTransport> {
  const trimmed = address.trim()
  if (!trimmed) throw new Error('Escribe la dirección IP del anfitrión.')
  const hasPort = /:\d+$/.test(trimmed)
  const ws = await openSocket(`ws://${hasPort ? trimmed : `${trimmed}:${LAN_DEFAULT_PORT}`}/`)
  return new LanClientTransport(ws)
}
