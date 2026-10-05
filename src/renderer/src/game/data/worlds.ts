import { EnemyType } from './enemies'
import { ENDLESS_BOSSES, SPAWN_TABLE, WAVE_EVENTS, type SpawnEntry, type WaveEvent } from './waves'

export const WORLD_COUNT = 2

export const WORLD_NAME = ['Noche de Hanabi', 'Ceniza Carmesí'] as const

/** World 2 is a harder mirror: same schedule, different yokai. */
const WORLD2_TYPE: Record<number, number> = {
  [EnemyType.Wisp]: EnemyType.Onibi,
  [EnemyType.Imp]: EnemyType.Gaki,
  [EnemyType.Crow]: EnemyType.Hinotori,
  [EnemyType.Kasa]: EnemyType.Hyottoko,
  [EnemyType.Yurei]: EnemyType.Funayurei,
  [EnemyType.Brute]: EnemyType.Gozu,
  [EnemyType.Spider]: EnemyType.Mukade,
  [EnemyType.Kodama]: EnemyType.Jubokko,
  [EnemyType.Tengu]: EnemyType.Amanojaku,
  [EnemyType.Nurikabe]: EnemyType.Wanyudo,
  [EnemyType.Chochin]: EnemyType.Hozuki,
  [EnemyType.Kappa]: EnemyType.Isoonna,
  [EnemyType.Nue]: EnemyType.Baku,
  [EnemyType.OniBoss]: EnemyType.Gashadokuro,
  [EnemyType.KitsuneBoss]: EnemyType.Tamamo,
  [EnemyType.OrochiBoss]: EnemyType.Umibozu,
  [EnemyType.RaijinBoss]: EnemyType.Raiju,
  [EnemyType.YukiBoss]: EnemyType.Hannya
}

const WORLD2_BOSSES: readonly number[] = [
  EnemyType.Hannya,
  EnemyType.Raiju,
  EnemyType.Umibozu,
  EnemyType.Tamamo,
  EnemyType.Gashadokuro
]

/** Minute-10 guardian replaces whatever boss occupied that slot. */
function gateAtTen(type: number, at: number): number {
  return at === 10 ? EnemyType.Gate : type
}

export function spawnTable(realm: number): readonly SpawnEntry[] {
  if (realm <= 0) return SPAWN_TABLE
  return SPAWN_TABLE.map((row) => ({ ...row, type: WORLD2_TYPE[row.type] ?? row.type }))
}

export function waveEvents(realm: number): readonly WaveEvent[] {
  return WAVE_EVENTS.map((ev) => {
    const mapped = realm > 0 && 'type' in ev ? (WORLD2_TYPE[ev.type] ?? ev.type) : ev.type
    return { ...ev, type: gateAtTen(mapped, ev.at) }
  })
}

export function endlessBosses(realm: number): readonly number[] {
  return realm > 0 ? WORLD2_BOSSES : ENDLESS_BOSSES
}

/** Flat multiplier for the whole realm. World 2 starts meaner than world 1 at minute 0. */
export function worldPower(realm: number): number {
  return realm <= 0 ? 1 : 1.9
}

/**
 * Once the portal is open, stats climb fast and the climb itself speeds up.
 * `minutes` is time spent with the portal already on the ground.
 */
export function portalPressure(minutes: number): number {
  const m = Math.max(0, minutes)
  return 1 + m * 1.15 + m * m * 0.42
}
