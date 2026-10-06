import { LAN_DEFAULT_PORT } from '@shared/constants'
import type { App } from '@/App'
import { ClientNet } from '@/net/ClientNet'
import { HostNet } from '@/net/HostNet'
import { hostLan, joinLan } from '@/net/lan'
import { hostOnline, joinOnline, makeInviteCode, normalizeCode } from '@/net/peer'
import type { ClientTransport } from '@/net/transport'
import type { FriendEntry } from '@shared/save'
import { el } from '../dom'
import { CHARACTERS } from '@/game/data/characters'
import { loadoutFromSave } from '@/game/data/cosmetics'
import { isUnlocked } from './CharacterSelect'
import { screenFrame, statusLine } from './common'

export function coopMenu(app: App, initialError = ''): HTMLElement {
  const save = app.save
  const frame = screenFrame('COOPERATIVO', 'Hasta 4 jugadores · el progreso y el oro se guardan para cada uno', save.gold, () => app.mainMenu())
  const status = statusLine()
  let busy = false

  const characterId = (): string => (isUnlocked(app, save.lastCharacter) ? save.lastCharacter : 'sakura')
  const hostInfo = () => {
    const id = characterId()
    return { name: save.settings.playerName, characterId: id, weaponId: CHARACTERS[id].weapon, cosmetics: loadoutFromSave(save) }
  }

  const run = async (label: string, task: () => Promise<void>): Promise<void> => {
    if (busy) return
    busy = true
    frame.root.classList.add('busy')
    status.set(label)
    try {
      await task()
    } catch (err) {
      status.set((err as Error).message, 'error')
      app.sfx.hurt()
    } finally {
      busy = false
      frame.root.classList.remove('busy')
    }
  }

  const join = async (connect: () => Promise<ClientTransport>): Promise<void> => {
    const transport = await connect()
    status.set('Conectado. Entrando en la sala…', 'ok')
    const net = await ClientNet.handshake(transport, { ...hostInfo(), metaUpgrades: save.metaUpgrades })
    app.clientLobby(net)
  }

  const panel = (title: string, desc: string, kind: string): HTMLElement => {
    const p = el('section', `coop-panel ${kind}`)
    p.append(el('h2', 'coop-title', title), el('p', 'coop-desc', desc))
    return p
  }

  // Online
  const online = panel('Online', 'Crea una sala y comparte el código de invitación con tus amigos. Funciona a través de Internet sin abrir puertos.', 'online')
  const createOnline = el('button', 'btn primary big', 'Crear sala online')
  createOnline.addEventListener('click', () =>
    run('Creando sala…', async () => {
      for (let attempt = 0; ; attempt++) {
        const code = makeInviteCode()
        try {
          const transport = await hostOnline(code)
          app.hostLobby(new HostNet(transport, hostInfo()), { kind: 'online', code })
          return
        } catch (err) {
          if ((err as { type?: string }).type !== 'unavailable-id' || attempt >= 3) throw err
        }
      }
    })
  )
  const codeInput = el('input', 'text-input code-input') as HTMLInputElement
  codeInput.placeholder = 'CÓDIGO'
  codeInput.maxLength = 8
  codeInput.addEventListener('input', () => (codeInput.value = normalizeCode(codeInput.value)))
  const joinOnlineBtn = el('button', 'btn', 'Unirse')
  const doJoinOnline = (): void => {
    const code = normalizeCode(codeInput.value)
    if (code.length < 6) {
      status.set('El código tiene 6 caracteres.', 'error')
      return
    }
    void run('Buscando la sala…', () => join(() => joinOnline(code)))
  }
  joinOnlineBtn.addEventListener('click', doJoinOnline)
  codeInput.addEventListener('keydown', (e) => e.key === 'Enter' && doJoinOnline())
  const onlineJoin = el('div', 'join-row')
  onlineJoin.append(codeInput, joinOnlineBtn)
  online.append(createOnline, el('div', 'or', 'o únete con un código'), onlineJoin)

  // LAN
  const lan = panel('Red local (LAN)', `Para jugar en la misma red Wi-Fi o cable. El anfitrión comparte su IP (puerto ${LAN_DEFAULT_PORT}).`, 'lan')
  const createLan = el('button', 'btn primary big', 'Crear sala LAN')
  if (!window.api) {
    createLan.classList.add('disabled')
    createLan.title = 'Disponible en la versión de escritorio'
  }
  createLan.addEventListener('click', () =>
    run('Abriendo servidor local…', async () => {
      const { transport, addresses, port } = await hostLan()
      app.hostLobby(new HostNet(transport, hostInfo()), { kind: 'lan', addresses, port })
    })
  )
  const ipInput = el('input', 'text-input') as HTMLInputElement
  ipInput.placeholder = '192.168.1.20'
  const joinLanBtn = el('button', 'btn', 'Unirse')
  const doJoinLan = (): void => void run('Conectando…', () => join(() => joinLan(ipInput.value)))
  joinLanBtn.addEventListener('click', doJoinLan)
  ipInput.addEventListener('keydown', (e) => e.key === 'Enter' && doJoinLan())
  const lanJoin = el('div', 'join-row')
  lanJoin.append(ipInput, joinLanBtn)
  lan.append(createLan, el('div', 'or', 'o únete con la IP del anfitrión'), lanJoin)

  const friends = friendsPanel(app, status, (friend) =>
    run(`Invitando a ${friend.name || friend.code}…`, async () => {
      for (let attempt = 0; ; attempt++) {
        const code = makeInviteCode()
        let host: Awaited<ReturnType<typeof hostOnline>> | null = null
        try {
          host = await hostOnline(code)
          await app.inviteFriend(friend.code, code)
          app.hostLobby(new HostNet(host, hostInfo()), { kind: 'online', code })
          return
        } catch (err) {
          host?.close()
          if ((err as { type?: string }).type !== 'unavailable-id' || attempt >= 3) throw err
        }
      }
    })
  )

  const panels = el('div', 'coop-panels')
  panels.append(online, lan, friends)
  frame.body.append(panels, status.node)
  if (initialError) status.set(initialError, 'error')
  return frame.root
}

function friendsPanel(app: App, status: ReturnType<typeof statusLine>, onInvite: (friend: FriendEntry) => void): HTMLElement {
  const save = app.save
  const panel = el('section', 'coop-panel friends')
  const head = el('div', 'friend-code-row')
  const copy = el('button', 'btn small', 'Copiar mi código')
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(save.friendCode)
    copy.textContent = '¡Copiado!'
    setTimeout(() => (copy.textContent = 'Copiar mi código'), 1500)
  })
  head.append(el('span', 'invite-label', 'Tu código de amigo'), el('span', 'friend-code', save.friendCode), copy)

  const list = el('div', 'friend-list')
  const render = (): void => {
    list.replaceChildren()
    if (save.friends.length === 0) {
      list.append(el('p', 'friend-empty', 'Aún no has añadido a nadie. Pídeles su código de amigo.'))
      return
    }
    for (const friend of save.friends) {
      const row = el('div', 'friend-row')
      const invite = el('button', 'btn small', 'Invitar')
      const remove = el('button', 'btn small', 'Quitar')
      invite.addEventListener('click', () => onInvite(friend))
      remove.addEventListener('click', () => {
        save.friends = save.friends.filter((f) => f.code !== friend.code)
        void app.persist()
        render()
      })
      row.append(el('span', 'friend-name', friend.name || 'Amigo'), el('span', 'friend-tag', friend.code), invite, remove)
      list.append(row)
    }
  }

  const codeInput = el('input', 'text-input code-input') as HTMLInputElement
  codeInput.placeholder = 'CÓDIGO'
  codeInput.maxLength = 8
  codeInput.addEventListener('input', () => (codeInput.value = normalizeCode(codeInput.value)))
  const nameInput = el('input', 'text-input') as HTMLInputElement
  nameInput.placeholder = 'Nombre'
  nameInput.maxLength = 16
  const add = el('button', 'btn', 'Añadir')
  const doAdd = (): void => {
    const code = normalizeCode(codeInput.value)
    const name = nameInput.value.trim().slice(0, 16)
    if (code.length < 6) {
      status.set('El código de amigo tiene 6 caracteres.', 'error')
      return
    }
    if (code === save.friendCode) {
      status.set('Ese es tu propio código.', 'error')
      return
    }
    if (save.friends.some((f) => f.code === code)) {
      status.set('Ese amigo ya está en la lista.', 'error')
      return
    }
    save.friends.push({ code, name: name || 'Amigo' })
    void app.persist()
    codeInput.value = ''
    nameInput.value = ''
    status.set(`${name || code} añadido.`, 'ok')
    app.sfx.ui()
    render()
  }
  add.addEventListener('click', doAdd)
  codeInput.addEventListener('keydown', (e) => e.key === 'Enter' && doAdd())
  const addRow = el('div', 'join-row')
  addRow.append(codeInput, nameInput, add)
  panel.append(
    el('h2', 'coop-title', 'Amigos'),
    el('p', 'coop-desc', 'Añade el código de un amigo e invítale. Tiene que tener el juego abierto, en los menús.'),
    head,
    addRow,
    list
  )
  render()
  return panel
}
