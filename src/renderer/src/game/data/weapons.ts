import type { LootRarity } from '@shared/protocol'
import type { IconFrame, IconKey } from '@/render/icons'
import { applyPrestige, buildPrestigeWeapons } from './prestige'
import type { PlayerStats } from './stats'

export type WeaponBehavior = 'slash' | 'talisman' | 'kunai' | 'orbit' | 'lightning' | 'aura' | 'boomerang' | 'firework'

/** Replacement pattern used by chest prestiges. */
export type WeaponForm = 'cross' | 'petals' | 'rain' | 'ring' | 'nova' | 'storm' | 'fan' | 'sides' | 'spin'

export interface WeaponStats {
  damage: number
  cooldown: number
  amount: number
  area: number
  speed: number
  duration: number
  /** Enemies a projectile can hit before vanishing (Infinity = unlimited). */
  pierce: number
  knockback: number
  /** Delay between projectiles of the same volley. */
  interval: number
}

export interface WeaponLevel {
  text: string
  mods: Partial<WeaponStats>
}

export interface WeaponDef {
  id: string
  name: string
  icon: IconKey
  description: string
  behavior: WeaponBehavior
  base: WeaponStats
  levels: readonly WeaponLevel[]
  /** Passive required (with this weapon at max level) to evolve from a chest. */
  evolvesWith?: string
  evolvesInto?: string
  evolution?: boolean
  /** Chest replacement. Not offered as a normal level-up weapon. */
  prestige?: boolean
  family?: string
  form?: WeaponForm
  /** Projectile art. Values at 32+ are the same art with a legendary gold glow. */
  visual?: number
  cluster?: boolean
}

const INF = Number.POSITIVE_INFINITY
const lv = (text: string, mods: Partial<WeaponStats>): WeaponLevel => ({ text, mods })

const CORE: Record<string, WeaponDef> = {
  katana: {
    id: 'katana',
    name: 'Abanico Carmesí',
    icon: 'katana',
    behavior: 'slash',
    description: 'Un tajo de viento hacia donde miras.',
    base: { damage: 14, cooldown: 1.05, amount: 1, area: 1, speed: 1, duration: 0.2, pierce: INF, knockback: 1, interval: 0.12 },
    levels: [
      lv('+1 corte en dirección opuesta.', { amount: 1 }),
      lv('Daño +6.', { damage: 6 }),
      lv('Área +15%. Daño +4.', { area: 0.15, damage: 4 }),
      lv('Daño +6.', { damage: 6 }),
      lv('Área +15%.', { area: 0.15 }),
      lv('Enfriamiento -0.15 s. Daño +5.', { cooldown: -0.15, damage: 5 }),
      lv('Daño +8.', { damage: 8 })
    ],
    evolvesWith: 'bushido',
    evolvesInto: 'senbonzakura'
  },
  senbonzakura: {
    id: 'senbonzakura',
    name: 'Senbonzakura',
    icon: 'sakura',
    behavior: 'slash',
    description: 'Evolución del Abanico Carmesí. Cortes devastadores que liberan pétalos afilados en todas direcciones.',
    base: { damage: 42, cooldown: 0.9, amount: 2, area: 1.5, speed: 1, duration: 0.25, pierce: INF, knockback: 1.3, interval: 0.1 },
    levels: [],
    evolution: true
  },

  talisman: {
    id: 'talisman',
    name: 'Ofuda Sagrado',
    icon: 'talisman',
    behavior: 'talisman',
    description: 'Lanza talismanes al enemigo más cercano.',
    base: { damage: 10, cooldown: 1.1, amount: 1, area: 1, speed: 1, duration: 2, pierce: 1, knockback: 0.5, interval: 0.1 },
    levels: [
      lv('+1 talismán.', { amount: 1 }),
      lv('Daño +5.', { damage: 5 }),
      lv('+1 talismán. Enfriamiento -0.1 s.', { amount: 1, cooldown: -0.1 }),
      lv('Atraviesa +1 enemigo.', { pierce: 1 }),
      lv('+1 talismán.', { amount: 1 }),
      lv('Daño +8.', { damage: 8 }),
      lv('Atraviesa +1 enemigo. Daño +5.', { pierce: 1, damage: 5 })
    ],
    evolvesWith: 'grimoire',
    evolvesInto: 'hundred_seals'
  },
  hundred_seals: {
    id: 'hundred_seals',
    name: 'Cien Sellos',
    icon: 'seal',
    behavior: 'talisman',
    description: 'Evolución del Ofuda. Una tormenta incesante de sellos dorados.',
    base: { damage: 20, cooldown: 0.35, amount: 4, area: 1.2, speed: 1.2, duration: 2.5, pierce: 3, knockback: 0.6, interval: 0.05 },
    levels: [],
    evolution: true
  },

  kunai: {
    id: 'kunai',
    name: 'Kunai',
    icon: 'kunai',
    behavior: 'kunai',
    description: 'Lanza kunais rápidos en la dirección de movimiento.',
    base: { damage: 14, cooldown: 0.7, amount: 1, area: 1, speed: 1.15, duration: 1.25, pierce: 1, knockback: 0.35, interval: 0.07 },
    levels: [
      lv('+1 kunai. Daño +6.', { amount: 1, damage: 6 }),
      lv('+1 kunai. Daño +6.', { amount: 1, damage: 6 }),
      lv('+1 kunai.', { amount: 1 }),
      lv('Atraviesa +1 enemigo.', { pierce: 1 }),
      lv('+1 kunai.', { amount: 1 }),
      lv('Daño +5.', { damage: 5 }),
      lv('+1 kunai. Atraviesa +1 enemigo.', { amount: 1, pierce: 1 })
    ],
    evolvesWith: 'wind_sandals',
    evolvesInto: 'kunai_storm'
  },
  kunai_storm: {
    id: 'kunai_storm',
    name: 'Tormenta de Kunais',
    icon: 'kunai',
    behavior: 'kunai',
    description: 'Evolución del Kunai. Una lluvia de acero sin pausa.',
    base: { damage: 14, cooldown: 0.3, amount: 6, area: 1, speed: 1.3, duration: 1.2, pierce: 3, knockback: 0.4, interval: 0.04 },
    levels: [],
    evolution: true
  },

  foxfire: {
    id: 'foxfire',
    name: 'Kitsunebi',
    icon: 'foxfire',
    behavior: 'orbit',
    description: 'Llamas espirituales que orbitan a tu alrededor.',
    base: { damage: 9, cooldown: 4, amount: 1, area: 1, speed: 1, duration: 2.5, pierce: INF, knockback: 0.6, interval: 0 },
    levels: [
      lv('+1 llama.', { amount: 1 }),
      lv('Velocidad +25%. Daño +4.', { speed: 0.25, damage: 4 }),
      lv('Duración +0.5 s. Área +20%.', { duration: 0.5, area: 0.2 }),
      lv('+1 llama.', { amount: 1 }),
      lv('Daño +6.', { damage: 6 }),
      lv('Duración +0.5 s. Velocidad +25%.', { duration: 0.5, speed: 0.25 }),
      lv('+1 llama. Daño +6.', { amount: 1, damage: 6 })
    ],
    evolvesWith: 'spirit_lantern',
    evolvesInto: 'nine_tails'
  },
  nine_tails: {
    id: 'nine_tails',
    name: 'Infierno de Nueve Colas',
    icon: 'nine_tails',
    behavior: 'orbit',
    description: 'Evolución del Kitsunebi. Un anillo permanente de fuego espiritual.',
    base: { damage: 22, cooldown: 4, amount: 6, area: 1.4, speed: 1.4, duration: 4, pierce: INF, knockback: 0.8, interval: 0 },
    levels: [],
    evolution: true
  },

  thunder: {
    id: 'thunder',
    name: 'Tambor de Raijin',
    icon: 'thunder',
    behavior: 'lightning',
    description: 'Invoca rayos sobre enemigos aleatorios.',
    base: { damage: 20, cooldown: 2.6, amount: 2, area: 1, speed: 1, duration: 0, pierce: INF, knockback: 0, interval: 0.12 },
    levels: [
      lv('+1 rayo.', { amount: 1 }),
      lv('Área +25%. Daño +8.', { area: 0.25, damage: 8 }),
      lv('+1 rayo.', { amount: 1 }),
      lv('Daño +10.', { damage: 10 }),
      lv('+1 rayo. Enfriamiento -0.2 s.', { amount: 1, cooldown: -0.2 }),
      lv('Área +25%.', { area: 0.25 }),
      lv('Daño +15.', { damage: 15 })
    ],
    evolvesWith: 'omamori',
    evolvesInto: 'raijin_wrath'
  },
  raijin_wrath: {
    id: 'raijin_wrath',
    name: 'Ira de Raijin',
    icon: 'thunder',
    behavior: 'lightning',
    description: 'Evolución del Tambor. Rayos en cadena que arrasan el campo.',
    base: { damage: 45, cooldown: 1.6, amount: 6, area: 1.8, speed: 1, duration: 0, pierce: INF, knockback: 0, interval: 0.06 },
    levels: [],
    evolution: true
  },

  aura: {
    id: 'aura',
    name: 'Barrera Espiritual',
    icon: 'barrier',
    behavior: 'aura',
    description: 'Un aura que daña y repele a los enemigos cercanos.',
    base: { damage: 5, cooldown: 0.65, amount: 1, area: 1, speed: 1, duration: 0, pierce: INF, knockback: 0.7, interval: 0 },
    levels: [
      lv('Área +20%. Daño +2.', { area: 0.2, damage: 2 }),
      lv('Pulso más rápido. Daño +2.', { cooldown: -0.05, damage: 2 }),
      lv('Área +20%.', { area: 0.2 }),
      lv('Daño +3.', { damage: 3 }),
      lv('Área +20%. Pulso más rápido.', { area: 0.2, cooldown: -0.05 }),
      lv('Daño +4.', { damage: 4 }),
      lv('Área +20%. Daño +4.', { area: 0.2, damage: 4 })
    ],
    evolvesWith: 'jade_heart',
    evolvesInto: 'sanctuary'
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Santuario',
    icon: 'torii',
    behavior: 'aura',
    description: 'Evolución de la Barrera. Un aura sagrada enorme que te cura al golpear.',
    base: { damage: 16, cooldown: 0.45, amount: 1, area: 2.2, speed: 1, duration: 0, pierce: INF, knockback: 1, interval: 0 },
    levels: [],
    evolution: true
  },

  shuriken: {
    id: 'shuriken',
    name: 'Shuriken',
    icon: 'shuriken',
    behavior: 'boomerang',
    description: 'Un shuriken que sale disparado y regresa como un bumerán.',
    base: { damage: 12, cooldown: 1.8, amount: 1, area: 1, speed: 1, duration: 2.4, pierce: INF, knockback: 0.6, interval: 0.15 },
    levels: [
      lv('Daño +6.', { damage: 6 }),
      lv('+1 shuriken.', { amount: 1 }),
      lv('Área +20%. Velocidad +20%.', { area: 0.2, speed: 0.2 }),
      lv('Daño +6.', { damage: 6 }),
      lv('+1 shuriken.', { amount: 1 }),
      lv('Daño +8.', { damage: 8 }),
      lv('Área +25%. Daño +6.', { area: 0.25, damage: 6 })
    ],
    evolvesWith: 'crystal_lens',
    evolvesInto: 'fuuma'
  },
  fuuma: {
    id: 'fuuma',
    name: 'Fūma Shuriken',
    icon: 'shuriken',
    behavior: 'boomerang',
    description: 'Evolución del Shuriken. Gigantescas cuchillas giratorias.',
    base: { damage: 38, cooldown: 1.5, amount: 2, area: 2.2, speed: 1.3, duration: 3, pierce: INF, knockback: 1, interval: 0.2 },
    levels: [],
    evolution: true
  },

  hanabi: {
    id: 'hanabi',
    name: 'Cohete Hanabi',
    icon: 'rocket',
    behavior: 'firework',
    description: 'Dispara fuegos artificiales que estallan en área.',
    base: { damage: 24, cooldown: 2.4, amount: 1, area: 1, speed: 1, duration: 1.6, pierce: 1, knockback: 1.2, interval: 0.18 },
    levels: [
      lv('+1 cohete.', { amount: 1 }),
      lv('Área +20%. Daño +8.', { area: 0.2, damage: 8 }),
      lv('Enfriamiento -0.3 s.', { cooldown: -0.3 }),
      lv('+1 cohete.', { amount: 1 }),
      lv('Daño +12.', { damage: 12 }),
      lv('Área +25%.', { area: 0.25 }),
      lv('+1 cohete. Daño +10.', { amount: 1, damage: 10 })
    ],
    evolvesWith: 'swift_scroll',
    evolvesInto: 'grand_finale'
  },
  grand_finale: {
    id: 'grand_finale',
    name: 'Gran Final',
    icon: 'firework',
    behavior: 'firework',
    description: 'Evolución del Hanabi. Cada explosión se divide en una cascada de estallidos.',
    base: { damage: 40, cooldown: 1.8, amount: 3, area: 1.6, speed: 1.2, duration: 1.6, pierce: 1, knockback: 1.5, interval: 0.12 },
    levels: [],
    evolution: true
  }
}

export const WEAPONS: Record<string, WeaponDef> = { ...CORE, ...buildPrestigeWeapons() }

/** Levels past the designed list. A higher rarity can keep climbing for longer. */
const EXTRA_LEVELS: Record<LootRarity, number> = { common: 8, rare: 16, epic: 26, legendary: 40 }

/** Level required to evolve. Extra levels come after this. */
/** Frame colour for HUD, pause and album. Prestiges use their own rarity. */
export function weaponIconFrame(def: WeaponDef): IconFrame {
  if (def.evolution) return 'evolution'
  if (!def.prestige || def.id.endsWith('_common')) return 'common'
  if (def.id.endsWith('_legendary')) return 'legendary'
  if (def.id.endsWith('_epic')) return 'epic'
  if (def.id.endsWith('_rare')) return 'rare'
  return 'weapon'
}

export function designedMaxLevel(def: WeaponDef): number {
  return def.levels.length + 1
}

export function weaponLootRarity(def: WeaponDef): LootRarity {
  if (def.evolution || def.id.endsWith('_legendary')) return 'legendary'
  if (def.id.endsWith('_epic')) return 'epic'
  if (def.id.endsWith('_rare')) return 'rare'
  return 'common'
}

export function maxWeaponLevel(def: WeaponDef): number {
  return designedMaxLevel(def) + EXTRA_LEVELS[weaponLootRarity(def)]
}

export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const stats = { ...def.base }
  const designed = def.levels.length
  for (let l = 0; l < level - 1 && l < designed; l++) {
    const mods = def.levels[l].mods
    for (const key of Object.keys(mods) as (keyof WeaponStats)[]) stats[key] += mods[key] ?? 0
  }
  const extra = Math.max(0, level - 1 - designed)
  if (extra > 0) {
    stats.damage += def.base.damage * 0.08 * extra
    stats.area += 0.035 * extra
    stats.cooldown = Math.max(0.12, stats.cooldown - 0.015 * extra)
  }
  return stats
}

/** Weapon numbers after designed levels and chest prestiges, before the player's global stats. */
export function weaponStatsBeforePlayer(def: WeaponDef, level: number, prestige: readonly number[] = [0, 0, 0, 0]): WeaponStats {
  const stats = weaponStatsAt(def, level)
  applyPrestige(stats, def.base.damage, prestige)
  return stats
}

function signed(n: number, digits: number, suffix = ''): string {
  const sign = n > 0 ? '+' : ''
  const body = digits === 0 ? String(Math.round(n)) : n.toFixed(digits)
  return `${sign}${body}${suffix}`
}

/** Numeric change from one weapon state to the next. Zero changes are left out. */
export function describeWeaponDelta(before: WeaponStats, after: WeaponStats): string {
  const parts: string[] = []
  const add = (label: string, delta: number, digits: number, suffix = ''): void => {
    if (Math.abs(delta) < (digits === 0 ? 0.5 : 0.004)) return
    parts.push(`${label} ${signed(delta, digits, suffix)}`)
  }
  add('Daño', after.damage - before.damage, 0)
  add('Enfriamiento', after.cooldown - before.cooldown, 2, ' s')
  add('Cantidad', after.amount - before.amount, 0)
  const area = (after.area - before.area) * 100
  add('Área', area, Math.abs(area - Math.round(area)) < 0.05 ? 0 : 1, '%')
  const speed = (after.speed - before.speed) * 100
  add('Velocidad', speed, Math.abs(speed - Math.round(speed)) < 0.05 ? 0 : 1, '%')
  add('Duración', after.duration - before.duration, 2, ' s')
  if (Number.isFinite(before.pierce) || Number.isFinite(after.pierce)) add('Atraviesa', after.pierce - before.pierce, 0)
  add('Empuje', after.knockback - before.knockback, 1)
  return parts.join(' · ')
}

/** Stat change across the levels one card grants. */
export function describeWeaponLevelUp(def: WeaponDef, nextLevel: number, steps = 1): string {
  const before = weaponStatsAt(def, Math.max(1, nextLevel - Math.max(1, steps)))
  const after = weaponStatsAt(def, nextLevel)
  return describeWeaponDelta(before, after)
}

/** Base numbers of a weapon you are about to pick up. */
export function describeWeaponSheet(stats: WeaponStats): string {
  const pierce = Number.isFinite(stats.pierce) ? String(stats.pierce) : '∞'
  return [
    `Daño ${Math.round(stats.damage)}`,
    `Enfriamiento ${stats.cooldown.toFixed(2)} s`,
    `Cantidad ${Math.round(stats.amount)}`,
    `Área ${Math.round(stats.area * 100)}%`,
    `Atraviesa ${pierce}`
  ].join(' · ')
}

/** Final stats after applying the owner's global multipliers. */
export function computeWeaponStats(def: WeaponDef, level: number, player: PlayerStats, prestige: readonly number[] = [0, 0, 0, 0]): WeaponStats {
  const s = weaponStatsBeforePlayer(def, level, prestige)
  return {
    damage: s.damage * player.might,
    cooldown: Math.max(0.08, s.cooldown * Math.max(0.4, player.cooldown)),
    amount: def.behavior === 'aura' ? 1 : s.amount + player.amount,
    area: s.area * player.area,
    speed: s.speed * player.speed,
    duration: s.duration * player.duration,
    pierce: s.pierce,
    knockback: s.knockback,
    interval: s.interval
  }
}
