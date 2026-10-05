import { defaultSettings, wipeProfile, type SaveData, type SaveSettings } from '@shared/save'
import type { App } from '@/App'
import { el } from '../dom'
import { screenFrame } from './common'

/** Shared by the main menu and the pause menu during a run. */
export function settingsPanel(save: SaveData, onChange: () => void, onWipe?: () => void): HTMLElement {
  const panel = el('div', 'settings-panel')
  const paint = (): void => {
    panel.replaceChildren()
    buildSettings(panel, save, onChange, paint, onWipe)
  }
  paint()
  return panel
}

function buildSettings(panel: HTMLElement, save: SaveData, onChange: () => void, repaint: () => void, onWipe?: () => void): void {
  const s = save.settings

  const commit = (): void => onChange()

  const row = (label: string, control: HTMLElement): void => {
    const r = el('label', 'setting-row')
    r.append(el('span', 'setting-label', label), control)
    panel.append(r)
  }

  const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'screenShake', max = 1): HTMLElement => {
    const wrap = el('div', 'slider')
    const input = el('input') as HTMLInputElement
    input.type = 'range'
    input.min = '0'
    input.max = String(max)
    input.step = '0.05'
    input.value = String(s[key])
    const value = el('span', 'slider-value', `${Math.round(s[key] * 100)}%`)
    input.addEventListener('input', () => {
      s[key] = Number(input.value)
      value.textContent = `${Math.round(s[key] * 100)}%`
      commit()
    })
    wrap.append(input, value)
    return wrap
  }

  const toggle = (key: keyof Pick<SaveSettings, 'musicEnabled' | 'damageNumbers' | 'fullscreen'>): HTMLElement => {
    const btn = el('button', `toggle${s[key] ? ' on' : ''}`) as HTMLButtonElement
    btn.type = 'button'
    btn.append(el('span', 'toggle-knob'))
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      s[key] = !s[key]
      if (key === 'fullscreen') s.fullscreenChosen = true
      btn.classList.toggle('on', s[key])
      commit()
    })
    return btn
  }

  const name = el('input', 'text-input') as HTMLInputElement
  name.maxLength = 16
  name.value = s.playerName
  name.addEventListener('change', () => {
    s.playerName = name.value.trim().slice(0, 16) || 'Jugador'
    name.value = s.playerName
    commit()
  })

  row('Nombre en cooperativo', name)
  row('Volumen general', slider('masterVolume'))
  row('Música', toggle('musicEnabled'))
  row('Volumen de la música', slider('musicVolume'))
  row('Efectos de sonido', slider('sfxVolume'))
  row('Vibración de pantalla', slider('screenShake', 1.5))
  row('Números de daño', toggle('damageNumbers'))
  if (window.api) row('Pantalla completa (F11)', toggle('fullscreen'))

  const help = el('div', 'controls-help')
  help.append(
    el('div', 'controls-title', 'Controles'),
    el('div', '', 'Mover: WASD / Flechas / Stick izquierdo'),
    el('div', '', 'Elegir mejora: 1–4 o clic'),
    el('div', '', 'Pausa / menú: Esc')
  )
  panel.append(help)

  const reset = el('button', 'settings-reset', 'Restaurar valores por defecto') as HTMLButtonElement
  reset.type = 'button'
  reset.addEventListener('click', () => {
    const name = s.playerName
    Object.assign(s, defaultSettings(), { playerName: name })
    commit()
    repaint()
  })
  panel.append(reset)
  if (onWipe) panel.append(wipeBlock(onWipe))
}

function wipeBlock(onWipe: () => void): HTMLElement {
  const box = el('div', 'settings-danger')
  const ask = el('button', 'settings-wipe', 'Borrar todos los datos') as HTMLButtonElement
  ask.type = 'button'
  ask.addEventListener('click', () => {
    const host = ask.closest('.screen') ?? document.body
    host.append(wipeDialog(onWipe))
  })
  box.append(ask)
  return box
}

function wipeDialog(onWipe: () => void): HTMLElement {
  const modal = el('div', 'wipe-modal')
  const card = el('div', 'wipe-card')
  const yes = el('button', 'settings-wipe', 'Sí, borrar todo') as HTMLButtonElement
  const no = el('button', 'settings-reset', 'Cancelar') as HTMLButtonElement
  yes.type = 'button'
  no.type = 'button'
  const actions = el('div', 'settings-confirm-actions')
  actions.append(yes, no)
  card.append(
    el('div', 'wipe-title', '¿Seguro?'),
    el('p', 'settings-confirm-text', 'Se borrará el oro, los amigos, el progreso, lo desbloqueado y lo descubierto. Solo se conserva el nombre.'),
    actions
  )
  no.addEventListener('click', () => modal.remove())
  yes.addEventListener('click', () => {
    modal.remove()
    onWipe()
  })
  modal.append(card)
  return modal
}

export function settings(app: App): HTMLElement {
  const frame = screenFrame('AJUSTES', 'Los cambios se guardan automáticamente', app.save.gold, () => app.mainMenu())
  frame.body.append(
    settingsPanel(
      app.save,
      () => {
        app.applySettings()
        void app.persist()
      },
      () => {
        wipeProfile(app.save)
        app.applySettings()
        void app.persist()
        try {
          app.restartPresence()
        } catch {
          // A failed friend listener must not keep the old profile on screen.
        }
        app.settings()
      }
    )
  )
  return frame.root
}
