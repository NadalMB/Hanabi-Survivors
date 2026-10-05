import { networkInterfaces } from 'node:os'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import { LAN_BROADCAST_ID } from '@shared/constants'

/**
 * LAN relay hosted in the Electron main process. The host's renderer connects
 * locally with `?role=host`; every other connection is a client.
 *
 * Framing between hub and host (clients never see it):
 *  - text:   "<peerId>|<payload>"
 *  - binary: [u16 peerId][payload]
 * Peer id 0 is reserved for hub control messages ("connect"/"disconnect").
 * Host → hub uses the same framing, with LAN_BROADCAST_ID meaning everyone.
 */
export class LanHub {
  private wss: WebSocketServer | null = null
  private host: WebSocket | null = null
  private readonly clients = new Map<number, WebSocket>()
  private nextId = 1

  get running(): boolean {
    return this.wss !== null
  }

  start(port: number): Promise<number> {
    if (this.wss) return Promise.resolve(port)
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port, host: '0.0.0.0', maxPayload: 4 * 1024 * 1024 })
      wss.once('listening', () => {
        this.wss = wss
        resolve(port)
      })
      wss.once('error', (err) => {
        wss.close()
        reject(err)
      })
      wss.on('connection', (ws, req) => {
        const url = new URL(req.url ?? '/', 'http://hub')
        const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
        if (url.searchParams.get('role') === 'host' && loopback && !this.host) this.attachHost(ws)
        else this.attachClient(ws)
      })
    })
  }

  stop(): void {
    for (const ws of this.clients.values()) ws.close()
    this.clients.clear()
    this.host?.close()
    this.host = null
    this.wss?.close()
    this.wss = null
  }

  private attachHost(ws: WebSocket): void {
    this.host = ws
    ws.on('message', (data, isBinary) => this.fromHost(data, isBinary))
    ws.on('close', () => {
      if (this.host === ws) this.stop()
    })
  }

  private attachClient(ws: WebSocket): void {
    if (!this.host) {
      ws.close(1013, 'no host')
      return
    }
    const id = this.nextId++
    this.clients.set(id, ws)
    this.control('connect', id)
    ws.on('message', (data, isBinary) => {
      const host = this.host
      if (!host || host.readyState !== WebSocket.OPEN) return
      if (isBinary) {
        const payload = toBuffer(data)
        const framed = Buffer.allocUnsafe(payload.length + 2)
        framed.writeUInt16LE(id, 0)
        payload.copy(framed, 2)
        host.send(framed)
      } else {
        host.send(`${id}|${toBuffer(data).toString('utf8')}`)
      }
    })
    ws.on('close', () => {
      this.clients.delete(id)
      this.control('disconnect', id)
    })
  }

  private control(t: 'connect' | 'disconnect', id: number): void {
    if (this.host?.readyState === WebSocket.OPEN) this.host.send(`0|${JSON.stringify({ t, id })}`)
  }

  private fromHost(data: RawData, isBinary: boolean): void {
    const buf = toBuffer(data)
    if (isBinary) {
      const to = buf.readUInt16LE(0)
      const payload = buf.subarray(2)
      this.route(to, (ws) => ws.send(payload))
      return
    }
    const text = buf.toString('utf8')
    const sep = text.indexOf('|')
    if (sep < 0) return
    const to = Number(text.slice(0, sep))
    const payload = text.slice(sep + 1)
    if (payload === '__kick') {
      this.clients.get(to)?.close()
      return
    }
    this.route(to, (ws) => ws.send(payload))
  }

  private route(to: number, send: (ws: WebSocket) => void): void {
    if (to === LAN_BROADCAST_ID) {
      for (const ws of this.clients.values()) if (ws.readyState === WebSocket.OPEN) send(ws)
    } else {
      const ws = this.clients.get(to)
      if (ws?.readyState === WebSocket.OPEN) send(ws)
    }
  }
}

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (Array.isArray(data)) return Buffer.concat(data)
  return Buffer.from(data)
}

export function localIPv4Addresses(): string[] {
  const out: string[] = []
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal) out.push(info.address)
    }
  }
  return out
}
