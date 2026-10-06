import { ENEMIES } from '@/game/data/enemies'
import { WORLD_NAME } from '@/game/data/worlds'
import { PASSIVES } from '@/game/data/passives'
import { maxWeaponLevel, weaponIconFrame, WEAPONS } from '@/game/data/weapons'
import { MAX_PASSIVE_SLOTS, MAX_WEAPON_SLOTS } from '@/game/sim/config'
import type { Player } from '@/game/sim/Player'
import type { World } from '@/game/sim/World'
import { iconImg, type IconFrame, type IconKey } from '@/render/icons'
import { el, formatTime } from './dom'

type BannerTone = 'boss' | 'chest' | 'evolution' | 'info'

export class Hud {
  readonly root = el('div', 'hud')
  private readonly xpFill = el('div', 'xp-fill')
  private readonly level = el('div', 'xp-level')
  private readonly timer = el('div', 'hud-timer')
  private readonly worldName = el('span', 'hud-world')
  private readonly clock = el('span', 'hud-clock')
  private readonly kills = el('span')
  private readonly gold = el('span')
  private readonly hpFill = el('div', 'hp-fill')
  private readonly hpText = el('span', 'hp-text')
  private readonly weapons = el('div', 'slot-row')
  private readonly passives = el('div', 'slot-row')
  private readonly bossBar = el('div', 'boss-bar')
  private readonly bossFill = el('div', 'boss-fill')
  private readonly bossName = el('div', 'boss-name')
  private readonly banners = el('div', 'banner-stack')
  private readonly waiting = el('div', 'waiting', 'Esperando a que los demás elijan mejora…')
  private readonly fps = el('div', 'fps')
  private last = { xp: -1, level: -1, time: -1, kills: -1, gold: -1, hp: -1, loadout: '', boss: -1 }
  private fpsAccum = 0
  private fpsFrames = 0

  constructor(parent: HTMLElement, showFps: boolean) {
    this.timer.append(this.worldName, this.clock)
    const xp = el('div', 'xp-bar')
    xp.append(this.xpFill, this.level)

    const stats = el('div', 'hud-stats')
    const k = el('div', 'stat-pill')
    k.append(iconImg('skull', 'none', 'stat-icon'), this.kills)
    const g = el('div', 'stat-pill gold')
    g.append(iconImg('coin', 'none', 'stat-icon'), this.gold)
    stats.append(k, g)

    const hp = el('div', 'hp-bar')
    hp.append(this.hpFill, this.hpText)

    const loadout = el('div', 'loadout')
    loadout.append(hp, this.weapons, this.passives)

    this.bossBar.append(this.bossName, el('div', 'boss-track'))
    this.bossBar.lastElementChild!.append(this.bossFill)

    this.root.append(xp, this.timer, stats, loadout, this.bossBar, this.banners, this.waiting)
    if (showFps) this.root.append(this.fps)
    parent.append(this.root)
  }

  destroy(): void {
    this.root.remove()
  }

  setWaiting(on: boolean): void {
    this.waiting.classList.toggle('visible', on)
  }

  update(world: World, local: Player, frameSeconds: number): void {
    const last = this.last
    const xpRatio = world.xp / world.xpToNext
    if (Math.abs(xpRatio - last.xp) > 0.002) {
      this.xpFill.style.transform = `scaleX(${Math.min(1, xpRatio)})`
      last.xp = xpRatio
    }
    if (world.level !== last.level) {
      this.level.textContent = `NV ${world.level}`
      last.level = world.level
    }
    const secs = Math.floor(world.time)
    const stamp = world.realm * 100000 + secs
    if (stamp !== last.time || world.endless !== this.timer.classList.contains('endless')) {
      this.worldName.textContent = WORLD_NAME[world.realm] ?? `Mundo ${world.realm + 1}`
      this.clock.textContent = formatTime(secs)
      this.timer.classList.toggle('endless', world.endless)
      last.time = stamp
    }
    if (world.kills !== last.kills) {
      this.kills.textContent = world.kills.toLocaleString('es-ES')
      last.kills = world.kills
    }
    const gold = Math.floor(world.gold)
    if (gold !== last.gold) {
      this.gold.textContent = gold.toLocaleString('es-ES')
      last.gold = gold
    }
    const hp = Math.ceil(Math.max(0, local.hp))
    if (hp !== last.hp) {
      const ratio = Math.max(0, Math.min(1, local.hp / local.stats.maxHp))
      this.hpFill.style.transform = `scaleX(${ratio})`
      this.hpFill.classList.toggle('low', ratio < 0.3)
      this.hpText.textContent = `${hp} / ${Math.round(local.stats.maxHp)}`
      last.hp = hp
    }
    const loadout = local.weapons.map((w) => `${w.id}:${w.level}`).join() + '|' + local.passives.map((p) => `${p.id}:${p.level}`).join()
    if (loadout !== last.loadout) {
      this.renderLoadout(local)
      last.loadout = loadout
    }
    this.updateBoss(world)

    this.fpsAccum += frameSeconds
    this.fpsFrames++
    if (this.fpsAccum >= 0.5) {
      this.fps.textContent = `${Math.round(this.fpsFrames / this.fpsAccum)} FPS · ${world.enemies.count} enemigos`
      this.fpsAccum = 0
      this.fpsFrames = 0
    }
  }

  private renderLoadout(p: Player): void {
    this.weapons.replaceChildren()
    this.passives.replaceChildren()
    for (let i = 0; i < MAX_WEAPON_SLOTS; i++) {
      const w = p.weapons[i]
      const def = w && WEAPONS[w.id]
      this.weapons.append(def ? this.slot(def.icon, weaponIconFrame(def), w.level, maxWeaponLevel(def), !!def.evolution || !!def.prestige) : el('div', 'slot empty'))
    }
    for (let i = 0; i < MAX_PASSIVE_SLOTS; i++) {
      const s = p.passives[i]
      const def = s && PASSIVES[s.id]
      this.passives.append(def ? this.slot(def.icon, 'passive', s.level, def.maxLevel, false) : el('div', 'slot empty'))
    }
  }

  private slot(icon: IconKey, frame: IconFrame, level: number, max: number, evolved: boolean): HTMLElement {
    const node = el('div', `slot${evolved ? ' evolved' : ''}${level >= max ? ' maxed' : ''}`)
    node.append(iconImg(icon, frame, 'slot-icon'))
    node.append(el('span', 'slot-level', level >= max ? 'MAX' : String(level)))
    return node
  }

  private updateBoss(world: World): void {
    const e = world.enemies
    let hp = 0
    let maxHp = 0
    let type = -1
    for (let i = 0; i < e.count; i++) {
      if (!ENEMIES[e.type[i]].boss) continue
      hp += Math.max(0, e.hp[i])
      maxHp += e.maxHp[i]
      type = e.type[i]
    }
    const ratio = maxHp > 0 ? hp / maxHp : -1
    if (Math.abs(ratio - this.last.boss) < 0.002) return
    this.last.boss = ratio
    this.bossBar.classList.toggle('visible', ratio >= 0)
    if (ratio >= 0) {
      this.bossFill.style.transform = `scaleX(${ratio})`
      this.bossName.textContent = ENEMIES[type].name
    }
  }

  banner(title: string, lines: string[] = [], tone: BannerTone = 'info', burst = false): void {
    const node = el('div', `banner ${tone}${burst ? ' burst' : ''}`)
    node.append(el('div', 'banner-title', title))
    for (const line of lines) node.append(el('div', 'banner-line', line))
    this.banners.append(node)
    const hold = burst ? 700 : 2600
    setTimeout(() => node.classList.add('leaving'), hold)
    setTimeout(() => node.remove(), hold + (burst ? 280 : 600))
  }
}
