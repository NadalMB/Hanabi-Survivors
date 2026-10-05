export interface PlayerStats {
  maxHp: number
  /** HP regenerated per second. */
  recovery: number
  /** Flat reduction of every incoming hit. */
  armor: number
  moveSpeed: number
  might: number
  area: number
  /** Projectile speed multiplier. */
  speed: number
  duration: number
  /** Extra projectiles for every weapon. */
  amount: number
  /** Cooldown multiplier (lower is faster). */
  cooldown: number
  magnet: number
  luck: number
  /** XP multiplier. */
  growth: number
  /** Gold multiplier. */
  greed: number
  revival: number
  critChance: number
}

export type StatKey = keyof PlayerStats
export type StatMods = Partial<PlayerStats>

export const BASE_STATS: Readonly<PlayerStats> = {
  maxHp: 100,
  recovery: 0,
  armor: 0,
  moveSpeed: 1,
  might: 1,
  area: 1,
  speed: 1,
  duration: 1,
  amount: 0,
  cooldown: 1,
  magnet: 1,
  luck: 1,
  growth: 1,
  greed: 1,
  revival: 0,
  critChance: 0.05
}

export function addMods(target: PlayerStats, mods: StatMods, times = 1): void {
  for (const key of Object.keys(mods) as StatKey[]) target[key] += (mods[key] ?? 0) * times
}

const PERCENT_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  'moveSpeed',
  'might',
  'area',
  'speed',
  'duration',
  'cooldown',
  'magnet',
  'luck',
  'growth',
  'greed',
  'critChance'
])

export const STAT_LABELS: Record<StatKey, string> = {
  maxHp: 'Vida máx.',
  recovery: 'Regeneración',
  armor: 'Armadura',
  moveSpeed: 'Velocidad',
  might: 'Poder',
  area: 'Área',
  speed: 'Vel. proyectil',
  duration: 'Duración',
  amount: 'Proyectiles',
  cooldown: 'Enfriamiento',
  magnet: 'Imán',
  luck: 'Suerte',
  growth: 'Experiencia',
  greed: 'Codicia',
  revival: 'Revivir',
  critChance: 'Crítico'
}

export function formatStat(key: StatKey, value: number): string {
  const sign = value >= 0 ? '+' : ''
  if (PERCENT_STATS.has(key)) return `${sign}${Math.round(value * 100)}%`
  return `${sign}${Number(value.toFixed(2))}${key === 'recovery' ? '/s' : ''}`
}

export function describeMods(mods: StatMods, times = 1): string {
  return (Object.keys(mods) as StatKey[])
    .map((key) => `${STAT_LABELS[key]} ${formatStat(key, (mods[key] ?? 0) * times)}`)
    .join(' · ')
}
