import { MAX_PLAYERS } from '@shared/constants'
import type { LobbyPlayer } from '@shared/protocol'
import type { App } from '@/App'
import { CHARACTER_ORDER, CHARACTERS, resolveStarter } from '@/game/data/characters'
import { describeMods } from '@/game/data/stats'
import { WEAPONS } from '@/game/data/weapons'
import type { ClientNet } from '@/net/ClientNet'
import type { HostNet } from '@/net/HostNet'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { isUnlocked } from './CharacterSelect'
import { portraitFor, screenFrame, statusLine } from './common'

export type Invite = { kind: 'online'; code: string } | { kind: 'lan'; addresses: string[]; port: number }

interface LobbyView {
  root: HTMLElement
  renderPlayers(players: LobbyPlayer[], localId: number): void
  setActions(nodes: HTMLElement[]): void
  status: ReturnType<typeof statusLine>
}

function lobbyView(app: App, invite: Invite | null, onPick: (characterId: string, weaponId: string) => void, onLeave: () => void): LobbyView {
  const frame = screenFrame('SALA COOPERATIVA', invite ? 'Invita a tus amigos y elegid heroína' : 'Elige heroína y marca que estás listo', app.save.gold, onLeave)
  const status = statusLine()

  const layout = el('div', 'lobby-layout')
  const side = el('div', 'lobby-side')

  if (invite) {
    const box = el('div', 'invite-box')
    if (invite.kind === 'online') {
      box.append(el('div', 'invite-label', 'Código de invitación'))
      const code = el('div', 'invite-code', invite.code)
      const copy = el('button', 'btn small', 'Copiar')
      copy.addEventListener('click', () => {
        void navigator.clipboard.writeText(invite.code)
        copy.textContent = '¡Copiado!'
        setTimeout(() => (copy.textContent = 'Copiar'), 1500)
      })
      box.append(code, copy, el('div', 'invite-hint', 'O invítales directamente si están en los menús'))
      const pals = el('div', 'lobby-friends')
      pals.append(el('div', 'invite-label', 'Invitar a un amigo'))
      if (app.save.friends.length === 0) pals.append(el('p', 'friend-empty', 'Añádelos antes en Cooperativo.'))
      for (const friend of app.save.friends) {
        const btn = el('button', 'btn small', `Invitar a ${friend.name || friend.code}`)
        btn.addEventListener('click', () => {
          btn.classList.add('disabled')
          void app.inviteFriend(friend.code, invite.code).then(
            () => {
              status.set(`Invitación enviada a ${friend.name || friend.code}.`, 'ok')
              btn.classList.remove('disabled')
            },
            (err: unknown) => {
              status.set((err as Error).message, 'error')
              btn.classList.remove('disabled')
            }
          )
        })
        pals.append(btn)
      }
      box.append(pals)
    } else {
      box.append(el('div', 'invite-label', 'Dirección LAN'))
      const list = invite.addresses.length ? invite.addresses : ['(sin red local detectada)']
      for (const a of list) box.append(el('div', 'invite-code small', `${a}:${invite.port}`))
      box.append(el('div', 'invite-hint', 'Si no conectan, permite el juego en el Firewall de Windows'))
    }
    side.append(box)
  }

  const picker = el('div', 'lobby-picker')
  picker.append(el('div', 'picker-label', 'Tu heroína'))
  const pickRow = el('div', 'picker-row')
  for (const id of CHARACTER_ORDER) {
    if (!isUnlocked(app, id)) continue
    const b = el('button', `picker-char${id === app.save.lastCharacter ? ' selected' : ''}`)
    b.style.setProperty('--accent', CHARACTERS[id].palette.accent)
    const img = el('img') as HTMLImageElement
    img.src = portraitFor(app, id)
    img.draggable = false
    b.append(img)
    b.title = CHARACTERS[id].name
    b.addEventListener('click', () => {
      pickRow.querySelectorAll('.picker-char').forEach((n) => n.classList.remove('selected'))
      b.classList.add('selected')
      app.save.lastCharacter = id
      void app.persist()
      app.sfx.ui()
      paintHero(id)
      onPick(id, CHARACTERS[id].weapon)
    })
    pickRow.append(b)
  }
  picker.append(pickRow)
  const hero = el('div', 'lobby-hero')
  const paintHero = (characterId: string): void => {
    const def = CHARACTERS[characterId] ?? CHARACTERS.sakura
    const weapon = WEAPONS[def.weapon]
    hero.replaceChildren(
      el('div', 'detail-title', def.title),
      el('div', 'detail-name', def.name),
      el('p', 'detail-desc', def.description),
      el('div', 'detail-bonus', `Bonificación: ${describeMods(def.mods)}`),
      el('div', 'lobby-start', `Empieza con ${weapon?.name ?? def.weapon}.`)
    )
    hero.style.setProperty('--accent', def.palette.accent)
  }
  paintHero(isUnlocked(app, app.save.lastCharacter) ? app.save.lastCharacter : 'sakura')
  picker.append(hero)
  side.append(picker)

  const slots = el('div', 'lobby-slots')
  const actions = el('div', 'actions lobby-actions')
  const main = el('div', 'lobby-main')
  main.append(slots, actions, status.node)
  layout.append(main, side)
  frame.body.append(layout)

  return {
    root: frame.root,
    status,
    renderPlayers(players, localId) {
      slots.replaceChildren()
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const p = players[i]
        if (!p) {
          const empty = el('div', 'player-slot empty')
          empty.append(el('div', 'slot-wait', 'Esperando jugador…'))
          slots.append(empty)
          continue
        }
        const def = CHARACTERS[p.characterId] ?? CHARACTERS.sakura
        const weaponDef = WEAPONS[def.weapon] ?? WEAPONS[resolveStarter(def.id, p.weaponId)]
        const slot = el('div', `player-slot${p.id === localId ? ' me' : ''}${p.ready ? ' ready' : ''}`)
        slot.style.setProperty('--accent', def.palette.accent)
        const img = el('img', 'slot-portrait') as HTMLImageElement
        const skin = p.cosmetics?.characterSkins[p.characterId] ?? (p.id === localId ? app.save.equipped.characterSkins[p.characterId] : undefined)
        img.src = app.textures.portraits[skin ?? def.id] ?? app.textures.portraits[def.id]
        img.draggable = false
        const info = el('div', 'slot-info')
        info.append(el('div', 'slot-name', p.name + (p.host ? ' ★' : '')), el('div', 'slot-char', `${def.name} · ${weaponDef.name}`))
        const weapon = iconImg(weaponDef.icon, 'weapon', 'slot-weapon')
        const state = el('div', `slot-state${p.ready ? ' on' : ''}`, p.host ? 'ANFITRIÓN' : p.ready ? 'LISTO' : 'ELIGIENDO')
        slot.append(img, info, weapon, state)
        slots.append(slot)
      }
    },
    setActions(nodes) {
      actions.replaceChildren(...nodes)
    }
  }
}

export function hostLobby(app: App, net: HostNet, invite: Invite): HTMLElement {
  const leave = (): void => {
    net.close()
    app.coopMenu()
  }
  const view = lobbyView(app, invite, (id, weaponId) => net.setHostCharacter(id, weaponId), leave)
  const start = el('button', 'btn primary big', '¡EMPEZAR!')
  start.addEventListener('click', () => {
    if (!net.allReady()) {
      view.status.set('Todos los jugadores deben estar listos.', 'error')
      app.sfx.hurt()
      return
    }
    const seed = (Math.random() * 0x100000000) >>> 0
    net.start(seed)
    app.startCoopHost(net, seed)
  })
  const back = el('button', 'btn', 'Cerrar sala')
  back.addEventListener('click', leave)
  view.setActions([start, back])

  const refresh = (): void => {
    view.renderPlayers(net.lobby, net.lobby[0].id)
    start.classList.toggle('disabled', !net.allReady())
    const n = net.playerCount
    view.status.set(n === 1 ? 'Esperando a que se unan tus amigos… (también puedes empezar solo)' : `${n} jugadores en la sala`, n > 1 ? 'ok' : 'info')
  }
  net.onLobbyChange = refresh
  refresh()
  return view.root
}

export function clientLobby(app: App, net: ClientNet): HTMLElement {
  let ready = false
  let characterId = isUnlocked(app, app.save.lastCharacter) ? app.save.lastCharacter : 'sakura'
  let weaponId = CHARACTERS[characterId].weapon
  const leave = (): void => {
    net.close()
    app.coopMenu()
  }
  const sendState = (): void => net.send({ t: 'lobby-update', characterId, weaponId, ready })
  const view = lobbyView(
    app,
    null,
    (id, weapon) => {
      characterId = id
      weaponId = weapon
      sendState()
    },
    leave
  )
  const readyBtn = el('button', 'btn primary big', '¡LISTO!')
  readyBtn.addEventListener('click', () => {
    ready = !ready
    readyBtn.textContent = ready ? 'NO ESTOY LISTO' : '¡LISTO!'
    readyBtn.classList.toggle('primary', !ready)
    app.sfx.ui()
    sendState()
  })
  const back = el('button', 'btn', 'Salir de la sala')
  back.addEventListener('click', leave)
  view.setActions([readyBtn, back])

  net.onLobby = (lobby) => view.renderPlayers(lobby, net.playerId)
  net.onStart = (_seed, players) => app.startCoopClient(net, players)
  net.onClose = (reason) => app.coopMenu(reason)
  view.renderPlayers(net.lobby, net.playerId)
  view.status.set('Conectado. Espera a que el anfitrión empiece la partida.', 'ok')
  return view.root
}
