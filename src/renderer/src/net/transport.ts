export type Packet = string | ArrayBuffer

/** Host side of a connection: many peers, addressed by a transport-local id. */
export interface HostTransport {
  readonly kind: 'online' | 'lan'
  onConnect: (peer: number) => void
  onMessage: (peer: number, data: Packet) => void
  onDisconnect: (peer: number) => void
  send(peer: number, data: Packet): void
  broadcast(data: Packet): void
  kick(peer: number): void
  close(): void
}

export interface ClientTransport {
  onMessage: (data: Packet) => void
  onClose: (reason: string) => void
  send(data: Packet): void
  close(): void
}

export const noop = (): void => {}
