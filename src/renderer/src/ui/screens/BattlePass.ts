import type { App } from '@/App'
import {
  PASS_LEVELS,
  PASS_NAME,
  PASS_PREMIUM_COST,
  PASS_TRACK,
  canClaim,
  claimAllPassRewards,
  claimPassReward,
  passLevel,
  rewardLabel,
  xpIntoLevel,
  xpRequiredForNext,
  type PassReward
} from '@/game/data/battlePass'
import { COSMETICS } from '@/game/data/cosmetics'
import { iconImg } from '@/render/icons'
import { el } from '../dom'
import { cosmeticArt, rarityBadge, screenFrame } from './common'

export function battlePass(app: App): HTMLElement {
  const save = app.save
  const frame = screenFrame('PASE DE BATALLA', `${PASS_NAME} · temporada ${save.battlePass.season}`, save.gold, () => app.mainMenu())

  const head = el('div', 'pass-head')
  const info = el('div', 'pass-info')
  const track = el('div', 'pass-track')
  frame.body.append(head, track)

  const paintReward = (reward: PassReward, locked: boolean): HTMLElement => {
    const node = el('div', `pass-reward${locked ? ' locked' : ''}`)
    if (reward.type === 'gold') {
      node.append(iconImg('coin', 'none', 'pass-gold-icon'), el('span', '', reward.amount.toLocaleString('es-ES')))
      return node
    }
    const def = COSMETICS[reward.id]
    if (def) {
      const img = cosmeticArt(app, def, 'pass-art')
      if (locked) img.classList.add('silhouette')
      node.append(img)
    } else node.append(el('span', '', rewardLabel(reward)))
    return node
  }

  const render = (): void => {
    const bp = save.battlePass
    const level = passLevel(bp.xp)
    const into = xpIntoLevel(bp.xp)
    const need = xpRequiredForNext(level)
    info.replaceChildren()
    const bar = el('div', 'pass-xp')
    const fill = el('div', 'pass-xp-fill')
    fill.style.transform = `scaleX(${level >= PASS_LEVELS ? 1 : into / need})`
    bar.append(fill)
    info.append(
      el('div', 'pass-level', `Nivel ${level} / ${PASS_LEVELS}`),
      bar,
      el('div', 'pass-xp-label', level >= PASS_LEVELS ? 'Pase completado' : `${into} / ${need} PE`)
    )

    const actions = el('div', 'pass-actions')
    if (!bp.premium) {
      const buy = el('button', `btn primary${save.gold < PASS_PREMIUM_COST ? ' poor' : ''}`)
      buy.append(el('span', '', `Desbloquear pase premium · ${PASS_PREMIUM_COST.toLocaleString('es-ES')} oro`))
      buy.addEventListener('click', () => {
        if (save.gold < PASS_PREMIUM_COST) {
          app.sfx.hurt()
          return
        }
        save.gold -= PASS_PREMIUM_COST
        save.battlePass.premium = true
        void app.persist()
        app.sfx.evolution()
        frame.setGold(save.gold)
        render()
      })
      actions.append(buy)
    } else {
      actions.append(el('div', 'pass-owned', 'Pase premium activo'))
    }
    const claimAll = el('button', 'btn', 'Reclamar todo')
    claimAll.addEventListener('click', () => {
      const n = claimAllPassRewards(save)
      if (!n) {
        app.sfx.hurt()
        return
      }
      void app.persist()
      app.sfx.chest()
      frame.setGold(save.gold)
      render()
    })
    actions.append(claimAll)
    head.replaceChildren(info, actions)

    track.replaceChildren()
    PASS_TRACK.forEach((tier, i) => {
      const unlocked = level > i
      const col = el('div', `pass-col${unlocked ? ' unlocked' : ''}`)
      col.append(el('div', 'pass-index', String(i + 1)))

      const freeSlot = el('div', `pass-slot free${tier.free?.type === 'cosmetic' && COSMETICS[tier.free.id] ? ` ${COSMETICS[tier.free.id].rarity}` : tier.free?.type === 'gold' ? ' gold' : ''}`)
      if (tier.free) {
        const claimed = bp.claimedFree.includes(i)
        freeSlot.append(paintReward(tier.free, !unlocked))
        freeSlot.append(el('div', 'pass-slot-name', rewardLabel(tier.free)))
        if (canClaim(save, i, 'free')) {
          const b = el('button', 'btn small primary', 'Reclamar')
          b.addEventListener('click', () => {
            claimPassReward(save, i, 'free')
            void app.persist()
            app.sfx.coin()
            frame.setGold(save.gold)
            render()
          })
          freeSlot.append(b)
        } else if (claimed) freeSlot.append(el('div', 'pass-claimed', 'Reclamado'))
      } else {
        freeSlot.append(el('div', 'pass-empty', '—'))
      }

      const premCosmetic = tier.premium.type === 'cosmetic' ? COSMETICS[tier.premium.id] : undefined
      const premSlot = el('div', `pass-slot premium${bp.premium ? '' : ' gated'}${premCosmetic ? ` ${premCosmetic.rarity}` : ' gold'}`)
      const claimedP = bp.claimedPremium.includes(i)
      premSlot.append(paintReward(tier.premium, !unlocked || !bp.premium))
      premSlot.append(el('div', 'pass-slot-name', rewardLabel(tier.premium)))
      if (premCosmetic) premSlot.append(rarityBadge(premCosmetic))
      if (canClaim(save, i, 'premium')) {
        const b = el('button', 'btn small primary', 'Reclamar')
        b.addEventListener('click', () => {
          claimPassReward(save, i, 'premium')
          void app.persist()
          app.sfx.chest()
          frame.setGold(save.gold)
          render()
        })
        premSlot.append(b)
      } else if (claimedP) premSlot.append(el('div', 'pass-claimed', 'Reclamado'))
      else if (!bp.premium) premSlot.append(el('div', 'pass-lock', 'Premium'))

      col.append(freeSlot, premSlot)
      track.append(col)
    })
  }

  render()
  return frame.root
}
