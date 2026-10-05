import { EnemyType } from './enemies'

/** Which enemy types the director may pick from, in minutes since the run started. */
export interface SpawnEntry {
  from: number
  to: number
  type: number
  weight: number
}

export const SPAWN_TABLE: readonly SpawnEntry[] = [
  { from: 0, to: 7, type: EnemyType.Wisp, weight: 10 },
  { from: 0.75, to: 12, type: EnemyType.Imp, weight: 8 },
  { from: 1.5, to: Infinity, type: EnemyType.Kodama, weight: 6 },
  { from: 2.5, to: 14, type: EnemyType.Crow, weight: 5 },
  { from: 3, to: Infinity, type: EnemyType.Tengu, weight: 5 },
  { from: 4, to: Infinity, type: EnemyType.Kasa, weight: 6 },
  { from: 6, to: Infinity, type: EnemyType.Yurei, weight: 5 },
  { from: 7, to: Infinity, type: EnemyType.Nurikabe, weight: 2 },
  { from: 8, to: Infinity, type: EnemyType.Brute, weight: 3 },
  { from: 9, to: Infinity, type: EnemyType.Chochin, weight: 5 },
  { from: 10, to: Infinity, type: EnemyType.Spider, weight: 5 },
  { from: 11, to: Infinity, type: EnemyType.Kappa, weight: 5 },
  { from: 13, to: Infinity, type: EnemyType.Nue, weight: 4 },
  { from: 14, to: Infinity, type: EnemyType.Brute, weight: 3 }
]

export type WaveEvent =
  | { at: number; kind: 'swarm'; type: number; count: number }
  | { at: number; kind: 'ring'; type: number; count: number }
  | { at: number; kind: 'boss'; type: number }

/** Scripted moments, sorted by `at` (minutes). */
export const WAVE_EVENTS: readonly WaveEvent[] = [
  { at: 1, kind: 'ring', type: EnemyType.Wisp, count: 36 },
  { at: 2, kind: 'swarm', type: EnemyType.Crow, count: 30 },
  { at: 3.5, kind: 'ring', type: EnemyType.Imp, count: 48 },
  { at: 4.5, kind: 'swarm', type: EnemyType.Tengu, count: 26 },
  { at: 5, kind: 'boss', type: EnemyType.OniBoss },
  { at: 6, kind: 'swarm', type: EnemyType.Crow, count: 50 },
  { at: 6.5, kind: 'boss', type: EnemyType.RaijinBoss },
  { at: 7.5, kind: 'ring', type: EnemyType.Kasa, count: 60 },
  { at: 8, kind: 'boss', type: EnemyType.YukiBoss },
  { at: 8.5, kind: 'boss', type: EnemyType.OrochiBoss },
  { at: 9, kind: 'swarm', type: EnemyType.Chochin, count: 36 },
  { at: 9.5, kind: 'boss', type: EnemyType.OniBoss },
  { at: 10, kind: 'boss', type: EnemyType.KitsuneBoss },
  { at: 11, kind: 'boss', type: EnemyType.RaijinBoss },
  { at: 11.5, kind: 'ring', type: EnemyType.Yurei, count: 70 },
  { at: 12.5, kind: 'boss', type: EnemyType.OrochiBoss },
  { at: 13, kind: 'swarm', type: EnemyType.Spider, count: 55 },
  { at: 13.5, kind: 'boss', type: EnemyType.YukiBoss },
  { at: 14, kind: 'ring', type: EnemyType.Kappa, count: 48 },
  { at: 15, kind: 'boss', type: EnemyType.OniBoss },
  { at: 15, kind: 'boss', type: EnemyType.KitsuneBoss },
  { at: 16, kind: 'boss', type: EnemyType.RaijinBoss },
  { at: 16.5, kind: 'swarm', type: EnemyType.Nue, count: 40 },
  { at: 17.5, kind: 'boss', type: EnemyType.YukiBoss },
  { at: 18, kind: 'boss', type: EnemyType.KitsuneBoss },
  { at: 18.5, kind: 'ring', type: EnemyType.Brute, count: 70 },
  { at: 19, kind: 'boss', type: EnemyType.OrochiBoss },
  { at: 19.5, kind: 'boss', type: EnemyType.OniBoss }
]

export const ELITE_FIRST_SECONDS = 90
export const ELITE_INTERVAL_SECONDS = 48
/** First miniboss, then a shrinking gap. */
export const MINIBOSS_FIRST_SECONDS = 150

/** Minutes used by the curves. Past 20 they accelerate, so endless mode keeps climbing. */
export function scaledMinutes(minutes: number): number {
  if (minutes <= 20) return minutes
  return 20 + (minutes - 20) * 1.85
}

export function targetEnemyCount(minutes: number): number {
  const m = scaledMinutes(minutes)
  return 24 + 36 * m + 2.1 * m * m
}

export function spawnRate(minutes: number): number {
  const m = scaledMinutes(minutes)
  return 3.2 + 2.6 * m
}

export function enemyHpScale(minutes: number): number {
  const m = scaledMinutes(minutes)
  return 1.65 + 0.72 * m + 0.075 * m * m
}

export function enemyDamageScale(minutes: number): number {
  const m = scaledMinutes(minutes)
  return 1.6 + 0.24 * m + 0.015 * m * m
}

export const ENDLESS_BOSSES: readonly number[] = [
  EnemyType.YukiBoss,
  EnemyType.RaijinBoss,
  EnemyType.OrochiBoss,
  EnemyType.KitsuneBoss,
  EnemyType.OniBoss
]
