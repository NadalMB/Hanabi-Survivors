import type { IconKey } from '@/render/icons'
import { ProjVisual } from '../sim/ProjectilePool'
import type { WeaponBehavior, WeaponDef, WeaponForm, WeaponLevel, WeaponStats } from './weapons'

/** Chest weapon replacements. Higher tiers are much stronger and much rarer. */
export const PRESTIGE_ORDER = ['common', 'rare', 'epic', 'legendary'] as const
export type PrestigeRarity = (typeof PRESTIGE_ORDER)[number]
export type ChestRarity = 'common' | 'rare' | 'epic' | 'legendary'

export const PRESTIGE_LABEL: Record<PrestigeRarity, string> = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario'
}

const GLOW = 32

interface PrestigeBonus {
  damage: number
  area: number
  cooldown: number
  amount: number
  pierce: number
  speed: number
  duration: number
  knockback: number
}

/** Extra stats from a level-up of that rarity. Common is only the normal level. */
const BONUS: Record<PrestigeRarity, PrestigeBonus> = {
  common: { damage: 0, area: 0, cooldown: 0, amount: 0, pierce: 0, speed: 0, duration: 0, knockback: 0 },
  rare: { damage: 0.55, area: 0.14, cooldown: -0.07, amount: 0, pierce: 0, speed: 0.1, duration: 0, knockback: 0 },
  epic: { damage: 0.95, area: 0.24, cooldown: -0.11, amount: 1, pierce: 1, speed: 0.16, duration: 0.16, knockback: 0.2 },
  legendary: { damage: 1.75, area: 0.45, cooldown: -0.18, amount: 2, pierce: 2, speed: 0.32, duration: 0.35, knockback: 0.5 }
}

export function emptyPrestige(): [number, number, number, number] {
  return [0, 0, 0, 0]
}

export function prestigeCount(counts: readonly number[]): number {
  return counts.reduce((sum, n) => sum + n, 0)
}

/** Stacks of rare, epic and legendary level-ups. Chests do not add these. */
export function applyPrestige(stats: WeaponStats, baseDamage: number, counts: readonly number[]): void {
  for (let i = 0; i < PRESTIGE_ORDER.length; i++) {
    const n = counts[i] ?? 0
    if (n <= 0) continue
    const mod = BONUS[PRESTIGE_ORDER[i]]
    stats.damage += baseDamage * mod.damage * n
    stats.area += mod.area * n
    stats.cooldown = Math.max(0.12, stats.cooldown + mod.cooldown * n)
    stats.amount += mod.amount * n
    stats.pierce += mod.pierce * n
    stats.speed += mod.speed * n
    stats.duration += mod.duration * n
    stats.knockback += mod.knockback * n
  }
}

const PARENT: Record<string, string> = {
  senbonzakura: 'katana',
  hundred_seals: 'talisman',
  kunai_storm: 'kunai',
  nine_tails: 'foxfire',
  raijin_wrath: 'thunder',
  sanctuary: 'aura',
  fuuma: 'shuriken',
  grand_finale: 'hanabi'
}

export function weaponFamily(id: string): string {
  return PARENT[id] ?? id.replace(/_(common|rare|epic|legendary)$/, '')
}

/**
 * Most chest cards stay common. Rare shows up often enough to notice,
 * epic is uncommon, and legendary stays a rare pull. Luck helps a little.
 */
export function chestRarityWeights(luck: number): [number, number, number, number] {
  const bonus = Math.max(0, luck - 1)
  return [1000, 120 * (1 + bonus * 0.12), 28 * (1 + bonus * 0.15), 6 * (1 + bonus * 0.18)]
}

interface FamilyForms {
  family: string
  behavior: WeaponBehavior
  icon: IconKey
  legendIcon: IconKey
  rows: FormRow[]
}

interface FormRow {
  rarity: ChestRarity
  name: string
  description: string
  form?: WeaponForm
  visual: number
  cluster?: boolean
  base: WeaponStats
}

const INF = Number.POSITIVE_INFINITY

const s = (partial: Partial<WeaponStats> & Pick<WeaponStats, 'damage' | 'cooldown' | 'amount'>): WeaponStats => ({
  damage: partial.damage,
  cooldown: partial.cooldown,
  amount: partial.amount,
  area: partial.area ?? 1,
  speed: partial.speed ?? 1,
  duration: partial.duration ?? 1.4,
  pierce: partial.pierce ?? INF,
  knockback: partial.knockback ?? 0.8,
  interval: partial.interval ?? 0.08
})

const FAMILIES: FamilyForms[] = [
  {
    family: 'katana',
    behavior: 'slash',
    icon: 'katana',
    legendIcon: 'sakura',
    rows: [
      { rarity: 'common', name: 'Corte Breve', description: 'Un tajo más corto y más rápido. Suele quedar por debajo de un abanico crecido.', form: 'cross', visual: ProjVisual.Petal, base: s({ damage: 16, cooldown: 0.72, amount: 1, area: 0.82, duration: 0.16, interval: 0.1 }) },
      { rarity: 'rare', name: 'Cuatro Vientos', description: 'Cuatro tajos, uno cada 90°. Ataca más rápido que el abanico.', form: 'cross', visual: ProjVisual.Petal, base: s({ damage: 22, cooldown: 0.68, amount: 4, area: 1.22, speed: 0.85, duration: 0.2, interval: 0.05 }) },
      { rarity: 'epic', name: 'Barrido Gemelo', description: 'Un barrido de 190° a cada lado. Más lento, más daño y más alcance.', form: 'sides', visual: ProjVisual.Petal, base: s({ damage: 36, cooldown: 1.35, amount: 1, area: 1.6, speed: 0.68, duration: 0.28, knockback: 1.15, interval: 0.08 }) },
      { rarity: 'legendary', name: 'Ciclón Carmesí', description: 'Una vuelta completa de 360°. El más lento, el que más duele y más abarca.', form: 'spin', visual: ProjVisual.Petal + GLOW, base: s({ damage: 54, cooldown: 1.9, amount: 1, area: 2.05, speed: 0.5, duration: 0.34, knockback: 1.35, interval: 0.08 }) }
    ]
  },
  {
    family: 'talisman',
    behavior: 'talisman',
    icon: 'talisman',
    legendIcon: 'seal',
    rows: [
      { rarity: 'common', name: 'Ofuda Doble', description: 'Dos sellos finos hacia el enemigo más cercano. Cuesta clavarlos, y cada uno pega fuerte.', form: 'fan', visual: ProjVisual.Talisman, base: s({ damage: 18, cooldown: 0.95, amount: 2, pierce: 1, duration: 1.4, knockback: 0.4, interval: 0.08 }) },
      { rarity: 'rare', name: 'Abanico de Sellos', description: 'Los sellos salen en abanico hacia donde apuntas.', form: 'fan', visual: ProjVisual.Seal, base: s({ damage: 16, cooldown: 0.7, amount: 4, pierce: 2, duration: 1.6, knockback: 0.5 }) },
      { rarity: 'epic', name: 'Lluvia de Ofuda', description: 'Una cortina de talismanes cae del cielo.', form: 'rain', visual: ProjVisual.Seal, base: s({ damage: 22, cooldown: 0.48, amount: 6, pierce: 3, duration: 1.8, knockback: 0.5 }) },
      { rarity: 'legendary', name: 'Vendaval Dorado', description: 'Un abanico dorado y denso de sellos, sin cerrarse en círculo.', form: 'fan', visual: ProjVisual.Seal + GLOW, base: s({ damage: 30, cooldown: 0.32, amount: 8, pierce: 4, area: 1.25, duration: 2, knockback: 0.6 }) }
    ]
  },
  {
    family: 'kunai',
    behavior: 'kunai',
    icon: 'kunai',
    legendIcon: 'kunai_storm',
    rows: [
      { rarity: 'common', name: 'Par de Kunai', description: 'Dos kunais rápidos y estrechos. Fallan a menudo, pero cada acierto duele.', form: 'fan', visual: ProjVisual.Kunai, base: s({ damage: 24, cooldown: 0.7, amount: 2, pierce: 1, duration: 1, knockback: 0.25, interval: 0.06 }) },
      { rarity: 'rare', name: 'Lluvia de Acero', description: 'Los kunais caen en vertical sobre el campo.', form: 'rain', visual: ProjVisual.Kunai, base: s({ damage: 12, cooldown: 0.45, amount: 5, pierce: 2, duration: 1.1, knockback: 0.3, interval: 0.04 }) },
      { rarity: 'epic', name: 'Rueda de Kunai', description: 'Una rueda de cuchillas sale en todas direcciones.', form: 'ring', visual: ProjVisual.Fuuma, base: s({ damage: 18, cooldown: 0.32, amount: 7, pierce: 3, duration: 1.2, knockback: 0.4 }) },
      { rarity: 'legendary', name: 'Eclipse de Acero', description: 'Rueda dorada de fuuma que barre el círculo entero.', form: 'ring', visual: ProjVisual.Fuuma + GLOW, base: s({ damage: 26, cooldown: 0.24, amount: 10, pierce: 4, area: 1.3, duration: 1.3, knockback: 0.5 }) }
    ]
  },
  {
    family: 'foxfire',
    behavior: 'orbit',
    icon: 'foxfire',
    legendIcon: 'nine_tails',
    rows: [
      { rarity: 'common', name: 'Chispa Kitsune', description: 'Una sola llama que sale disparada. Más débil que el anillo habitual.', form: 'nova', visual: ProjVisual.Foxfire, base: s({ damage: 8, cooldown: 1.5, amount: 2, duration: 0.9, knockback: 0.4 }) },
      { rarity: 'rare', name: 'Estallido Kitsune', description: 'Las llamas ya no orbitan: estallan hacia fuera.', form: 'nova', visual: ProjVisual.Foxfire, base: s({ damage: 16, cooldown: 1.3, amount: 4, duration: 1.2, knockback: 0.7 }) },
      { rarity: 'epic', name: 'Corona de Llamas', description: 'Un anillo de fuego espiritual que se abre de golpe.', form: 'ring', visual: ProjVisual.SpiritFlame, base: s({ damage: 24, cooldown: 1.05, amount: 6, area: 1.3, duration: 1.4, knockback: 0.8 }) },
      { rarity: 'legendary', name: 'Sol de Nueve Colas', description: 'Nova dorada y lenta que lo quema todo a tu alrededor.', form: 'nova', visual: ProjVisual.SpiritFlame + GLOW, base: s({ damage: 36, cooldown: 0.8, amount: 8, area: 1.5, duration: 1.5, knockback: 1 }) }
    ]
  },
  {
    family: 'thunder',
    behavior: 'lightning',
    icon: 'thunder',
    legendIcon: 'storm',
    rows: [
      { rarity: 'common', name: 'Chispazo', description: 'Un rayo corto y flojo sobre un enemigo cercano.', visual: 0, base: s({ damage: 14, cooldown: 2.1, amount: 1, area: 0.85, duration: 0, interval: 0.12 }) },
      { rarity: 'rare', name: 'Trueno en Cadena', description: 'El rayo salta de enemigo en enemigo.', form: 'storm', visual: 0, base: s({ damage: 36, cooldown: 1.7, amount: 3, area: 1.3, duration: 0, interval: 0.08 }) },
      { rarity: 'epic', name: 'Círculo de Raijin', description: 'Varios rayos caen en cadena alrededor tuyo.', form: 'storm', visual: 0, base: s({ damage: 52, cooldown: 1.35, amount: 5, area: 1.6, duration: 0, interval: 0.06 }) },
      { rarity: 'legendary', name: 'Juicio Dorado', description: 'Un círculo de rayos dorados y cadenas que no paran.', form: 'storm', visual: GLOW, base: s({ damage: 72, cooldown: 1.0, amount: 7, area: 2, duration: 0, interval: 0.05 }) }
    ]
  },
  {
    family: 'aura',
    behavior: 'aura',
    icon: 'barrier',
    legendIcon: 'torii',
    rows: [
      { rarity: 'common', name: 'Pulso Corto', description: 'Un aura pequeña y rápida. Cubre menos que la barrera de siempre.', visual: 0, base: s({ damage: 4, cooldown: 0.7, amount: 1, area: 0.75, knockback: 0.5, interval: 0 }) },
      { rarity: 'rare', name: 'Pulso de Pétalos', description: 'El aura dispara pétalos en cada pulso.', form: 'nova', visual: ProjVisual.Petal, base: s({ damage: 10, cooldown: 0.55, amount: 6, area: 1.4, knockback: 0.8, interval: 0 }) },
      { rarity: 'epic', name: 'Santuario Menor', description: 'Aura amplia que cura un poco al golpear.', form: 'storm', visual: 0, base: s({ damage: 16, cooldown: 0.42, amount: 1, area: 1.9, knockback: 1, interval: 0 }) },
      { rarity: 'legendary', name: 'Trono Espiritual', description: 'Santuario dorado: un pulso enorme que cura al golpear.', form: 'storm', visual: GLOW, base: s({ damage: 24, cooldown: 0.34, amount: 1, area: 2.4, knockback: 1.2, interval: 0 }) }
    ]
  },
  {
    family: 'shuriken',
    behavior: 'boomerang',
    icon: 'shuriken',
    legendIcon: 'fuuma',
    rows: [
      { rarity: 'common', name: 'Astilla', description: 'Una cuchilla pequeña que sale y no vuelve. Cuesta acertar, y el golpe es muy fuerte.', form: 'fan', visual: ProjVisual.Shuriken, base: s({ damage: 36, cooldown: 1.3, amount: 1, area: 0.8, duration: 1.1, knockback: 0.4 }) },
      { rarity: 'rare', name: 'Rueda Shuriken', description: 'Deja de volver: sale una rueda de cuchillas.', form: 'ring', visual: ProjVisual.Fuuma, base: s({ damage: 22, cooldown: 1.15, amount: 3, area: 1.3, duration: 1.6, knockback: 0.7 }) },
      { rarity: 'epic', name: 'Lluvia Fūma', description: 'Fuuma gigantes que caen desde arriba.', form: 'rain', visual: ProjVisual.Fuuma, base: s({ damage: 32, cooldown: 0.9, amount: 4, area: 1.6, duration: 1.5, knockback: 0.9 }) },
      { rarity: 'legendary', name: 'Eclipse Fūma', description: 'Rueda dorada de fuuma que cubre todo el círculo.', form: 'ring', visual: ProjVisual.Fuuma + GLOW, base: s({ damage: 50, cooldown: 0.72, amount: 5, area: 1.9, duration: 1.8, knockback: 1.1 }) }
    ]
  },
  {
    family: 'hanabi',
    behavior: 'firework',
    icon: 'rocket',
    legendIcon: 'firework',
    rows: [
      { rarity: 'common', name: 'Petardo', description: 'Un cohete corto y flojo. Estalla menos que el hanabi de siempre.', form: 'fan', visual: ProjVisual.Rocket, base: s({ damage: 16, cooldown: 2, amount: 1, area: 0.75, duration: 1.2, pierce: 1, knockback: 0.8, interval: 0.14 }) },
      { rarity: 'rare', name: 'Cascada Hanabi', description: 'Los cohetes caen del cielo y estallan al tocar suelo.', form: 'rain', visual: ProjVisual.Rocket, base: s({ damage: 36, cooldown: 1.55, amount: 3, area: 1.2, duration: 1.5, pierce: 1, knockback: 1.2, interval: 0.1 }) },
      { rarity: 'epic', name: 'Rueda de Cohetes', description: 'Una rueda de cohetes que se parte al explotar.', form: 'ring', visual: ProjVisual.Rocket, cluster: true, base: s({ damage: 48, cooldown: 1.25, amount: 4, area: 1.45, duration: 1.4, pierce: 1, knockback: 1.3, interval: 0.08 }) },
      { rarity: 'legendary', name: 'Festival Dorado', description: 'Festival de cohetes dorados que se dividen en cascada.', form: 'storm', visual: ProjVisual.Rocket + GLOW, cluster: true, base: s({ damage: 66, cooldown: 0.95, amount: 5, area: 1.7, duration: 1.5, pierce: 1, knockback: 1.5, interval: 0.07 }) }
    ]
  }
]

const BY_FAMILY = new Map<string, WeaponDef[]>()

function grow(damage: number): WeaponLevel[] {
  return [
    { text: 'El arma despierta.', mods: { damage: Math.round(damage * 0.22) } },
    { text: 'Más alcance.', mods: { area: 0.12 } },
    { text: 'Más proyectiles.', mods: { amount: 1 } },
    { text: 'Cadencia más rápida.', mods: { cooldown: -0.08, damage: Math.round(damage * 0.18) } }
  ]
}

export function buildPrestigeWeapons(): Record<string, WeaponDef> {
  const out: Record<string, WeaponDef> = {}
  for (const family of FAMILIES) {
    const list: WeaponDef[] = []
    for (const row of family.rows) {
      if (row.rarity === 'common') continue
      if (row.rarity === 'legendary' && family.family !== 'katana') continue
      const id = `${family.family}_${row.rarity}`
      const def: WeaponDef = {
        id,
        name: row.name,
        icon: `${family.family}_${row.rarity}` as IconKey,
        description: row.description,
        behavior: family.behavior,
        base: row.base,
        levels: grow(row.base.damage),
        family: family.family,
        form: row.form,
        visual: row.visual,
        cluster: row.cluster,
        prestige: true
      }
      out[id] = def
      list.push(def)
    }
    BY_FAMILY.set(family.family, list)
  }
  return out
}

export function prestigeOptions(family: string): readonly WeaponDef[] {
  return BY_FAMILY.get(family) ?? []
}
