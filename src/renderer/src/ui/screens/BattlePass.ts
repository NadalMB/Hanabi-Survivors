import type { App } from '@/App'
import {
  PASS_AVATAR_LEVEL,
  PASS_LEVELS,
  PASS_NAME,
  PASS_TRACK,
  canClaim,
  claimPassReward,
  passLevel,
  rewardLabel,
  xpIntoLevel,
  xpRequiredForNext
} from '@/game/data/battlePass'
import { COSMETICS } from '@/game/data/cosmetics'
import { el } from '../dom'
import { cosmeticArt, rarityBadge, screenFrame } from './common'

export function battlePass(app: App): HTMLElement {
  const save = app.save
  const frame = screenFrame('PASE DE BATALLA', `${PASS_NAME} · temporada ${save.battlePass.season}`, save.gold, () => app.mainMenu())

  const bp = save.battlePass
  const level = passLevel(bp.xp)
  const into = xpIntoLevel(bp.xp)
  const need = xpRequiredForNext(level)
  const done = level >= PASS_LEVELS
  const avatarIndex = PASS_AVATAR_LEVEL - 1
  const reward = PASS_TRACK[avatarIndex]?.free
  const cosmetic = reward?.type === 'cosmetic' ? COSMETICS[reward.id] : undefined

  const info = el('div', 'pass-info')
  const bar = el('div', 'pass-xp')
  const fill = el('div', 'pass-xp-fill')
  fill.style.transform = `scaleX(${done ? 1 : into / need})`
  bar.append(fill)
  info.append(
    el('div', 'pass-level', `Nivel ${level} / ${PASS_LEVELS}`),
    bar,
    el('div', 'pass-xp-label', done ? 'Pase al máximo' : `${into} / ${need} PE`)
  )

  const card = el('div', 'pass-feature')
  card.append(
    el('div', 'pass-feature-kicker', `NIVEL ${PASS_AVATAR_LEVEL} · GRATUITO`),
    el('h2', 'pass-feature-title', 'Recompensa actual')
  )

  if (cosmetic && reward) {
    const slot = el('div', `pass-feature-slot ${cosmetic.rarity}`)
    const art = cosmeticArt(app, cosmetic, 'pass-feature-art')
    art.classList.add('profile-avatar-img')
    const ring = el('div', 'pass-feature-ring')
    ring.append(art)
    slot.append(ring, rarityBadge(cosmetic), el('div', 'pass-slot-name', rewardLabel(reward)))

    const claimed = bp.claimedFree.includes(avatarIndex)
    const unlocked = level >= PASS_AVATAR_LEVEL
    if (claimed) {
      slot.append(el('div', 'pass-claimed', 'Reclamado'))
    } else if (!unlocked) {
      slot.append(el('div', 'pass-lock', `Se desbloquea en el nivel ${PASS_AVATAR_LEVEL}`))
    } else {
      const btn = el('button', 'btn primary', 'Reclamar')
      btn.addEventListener('click', () => {
        const label = claimPassReward(save, avatarIndex, 'free')
        if (!label) return
        app.sfx.ui()
        void app.persist()
        app.battlePass()
      })
      slot.append(btn)
    }
    if (canClaim(save, avatarIndex, 'free')) slot.classList.add('ready')
    else if (!unlocked) slot.classList.add('gated')
    card.append(slot)
  }

  card.append(el('p', 'pass-feature-note', 'De momento el pase solo entrega este icono de perfil. Más recompensas llegarán más adelante.'))

  frame.body.append(info, card)
  return frame.root
}
