import type { IconKey } from '@/render/icons'
import { accountLevel } from '@shared/account'
import type { SaveData } from '@shared/save'
import type { StatKey, StatMods } from './stats'

export interface SkillNeed {
  id: string
  rank: number
}

export interface SkillNodeDef {
  id: string
  name: string
  icon: IconKey
  perRank: StatMods
  maxRank: number
  /** Cost in skill points of each rank. Missing entries cost 1, then 2, then 3… */
  costs?: readonly number[]
  /** Every listed node must already be at that rank. */
  requires?: readonly SkillNeed[]
  /** At least one listed node must already be at that rank. */
  requiresAny?: readonly SkillNeed[]
}

const node = (
  id: string,
  name: string,
  icon: IconKey,
  perRank: StatMods,
  maxRank: number,
  extra: Pick<SkillNodeDef, 'costs' | 'requires' | 'requiresAny'> = {}
): SkillNodeDef => ({ id, name, icon, perRank, maxRank, ...extra })

const hub = (): readonly SkillNeed[] => [{ id: 'vitalidad', rank: 1 }]

/**
 * One radial tree. Vitalidad (life) is the hub; offense, loot and weapon power
 * fork outward, and the rest of Santuario climbs upward.
 */
export const SKILL_NODES: readonly SkillNodeDef[] = [
  node('vitalidad', 'Vitalidad', 'heart', { maxHp: 12 }, 5),
  node('coraza', 'Coraza', 'armor', { armor: 1 }, 3, { requires: [{ id: 'vitalidad', rank: 2 }] }),
  node('aliento', 'Aliento', 'tea', { recovery: 0.12 }, 4, { requires: [{ id: 'vitalidad', rank: 2 }] }),
  node('renacer', 'Renacer', 'phoenix', { revival: 1 }, 1, { costs: [5], requires: [{ id: 'coraza', rank: 2 }, { id: 'aliento', rank: 2 }] }),

  node('filo', 'Filo', 'crossed_swords', { might: 0.05 }, 5, { requires: hub() }),
  node('tempo', 'Tempo', 'hourglass', { cooldown: -0.015 }, 4, { requires: [{ id: 'filo', rank: 2 }] }),
  node('mira', 'Mira', 'omamori', { luck: 0.05 }, 4, { requires: [{ id: 'filo', rank: 2 }] }),
  node('rafaga', 'Ráfaga', 'mirror', { amount: 1 }, 1, { costs: [4], requires: [{ id: 'tempo', rank: 2 }, { id: 'mira', rank: 2 }] }),

  node('agilidad', 'Agilidad', 'leaf', { moveSpeed: 0.04 }, 4, { requires: hub() }),
  node('iman', 'Imán', 'bell', { magnet: 0.06 }, 4, { requires: [{ id: 'agilidad', rank: 1 }] }),
  node('sabiduria', 'Sabiduría', 'book', { growth: 0.035 }, 4, { requires: [{ id: 'agilidad', rank: 2 }] }),
  node('codicia', 'Codicia', 'coin', { greed: 0.1 }, 5, { requires: [{ id: 'iman', rank: 2 }] }),

  node('amplitud', 'Amplitud', 'crystal', { area: 0.05 }, 3, { requires: hub() }),
  node('impulso', 'Impulso', 'feather', { speed: 0.05 }, 3, { requires: [{ id: 'amplitud', rank: 2 }] }),
  node('persistencia', 'Persistencia', 'lantern', { duration: 0.05 }, 3, { requires: [{ id: 'impulso', rank: 2 }] })
]

const BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]))

export type SkillTone = 'acero' | 'santuario' | 'viento' | 'hanabi'

export interface SkillBranch {
  id: SkillTone
  name: string
  kicker: string
  text: string
  nodes: readonly string[]
}

/** Tone groups for link / node colors. */
export const SKILL_BRANCHES: readonly SkillBranch[] = [
  {
    id: 'santuario',
    name: 'Santuario',
    kicker: 'Supervivencia',
    text: 'La vida es el centro. Coraza y aliento abren el renacer.',
    nodes: ['vitalidad', 'coraza', 'aliento', 'renacer']
  },
  {
    id: 'acero',
    name: 'Acero',
    kicker: 'Ofensiva',
    text: 'Primero pegas más fuerte. Luego atacas antes y con más suerte.',
    nodes: ['filo', 'tempo', 'mira', 'rafaga']
  },
  {
    id: 'viento',
    name: 'Viento',
    kicker: 'Botín',
    text: 'Correr más abre el imán y la experiencia.',
    nodes: ['agilidad', 'iman', 'sabiduria', 'codicia']
  },
  {
    id: 'hanabi',
    name: 'Hanabi',
    kicker: 'Armas',
    text: 'El ataque crece, vuela y dura.',
    nodes: ['amplitud', 'impulso', 'persistencia']
  }
]

function polar(angle: number, radius: number): { x: number; y: number } {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

const R1 = 200
const R2 = 370
const R3 = 530
const WEST = Math.PI
const NORTH = -Math.PI / 2
const EAST = 0
const SOUTH = Math.PI / 2
const SPREAD = 0.36

/**
 * World-space layout centered on Vitalidad. Positive Y is down on screen (CSS).
 */
export const SKILL_TREE_LAYOUT: Readonly<Record<string, { x: number; y: number }>> = {
  vitalidad: { x: 0, y: 0 },

  coraza: polar(NORTH - SPREAD, R1),
  aliento: polar(NORTH + SPREAD, R1),
  renacer: polar(NORTH, R2),

  filo: polar(WEST, R1),
  tempo: polar(WEST - SPREAD, R2),
  mira: polar(WEST + SPREAD, R2),
  rafaga: polar(WEST, R3),

  agilidad: polar(EAST, R1),
  iman: polar(EAST - SPREAD, R2),
  sabiduria: polar(EAST + SPREAD, R2),
  codicia: polar(EAST, R3),

  amplitud: polar(SOUTH, R1),
  impulso: polar(SOUTH, R2),
  persistencia: polar(SOUTH, R3)
}

/** Board half-extent used by the pan/zoom viewport. */
export const SKILL_BOARD = 680

export const SKILL_HUB_ID = 'vitalidad'

/** Drop the retired hub node and keep old branch progress playable. */
export function migrateSkillTree(purchased: Record<string, number>): void {
  if (purchased.origen != null) delete purchased.origen
  const branched = (purchased.filo ?? 0) > 0 || (purchased.agilidad ?? 0) > 0 || (purchased.amplitud ?? 0) > 0
  if (branched && (purchased.vitalidad ?? 0) < 1) purchased.vitalidad = 1
}

export function skillTone(id: string): SkillTone {
  for (const branch of SKILL_BRANCHES) {
    if (branch.nodes.includes(id)) return branch.id
  }
  return 'santuario'
}

export function skillNode(id: string): SkillNodeDef | undefined {
  return BY_ID.get(id)
}

export function skillRankCost(def: SkillNodeDef, ownedRank: number): number {
  return def.costs?.[ownedRank] ?? ownedRank + 1
}

export function pointsSpent(purchased: Record<string, number>): number {
  let total = 0
  for (const def of SKILL_NODES) {
    const rank = Math.min(Math.max(0, purchased[def.id] ?? 0), def.maxRank)
    for (let r = 0; r < rank; r++) total += skillRankCost(def, r)
  }
  return total
}

/** Levels above 1 each grant one skill point. Spent points are already in the tree. */
export function skillPointsLeft(save: Pick<SaveData, 'accountXp' | 'metaUpgrades'>): number {
  migrateSkillTree(save.metaUpgrades)
  return Math.max(0, accountLevel(save.accountXp) - 1 - pointsSpent(save.metaUpgrades))
}

export function skillRequirementText(purchased: Record<string, number>, def: SkillNodeDef): string | null {
  const missing = (def.requires ?? []).filter((req) => (purchased[req.id] ?? 0) < req.rank)
  if (missing.length > 0) {
    return `Requiere ${missing.map((req) => `${skillNode(req.id)?.name ?? req.id} ${req.rank}`).join(' y ')}`
  }
  if (def.requiresAny?.length && !def.requiresAny.some((req) => (purchased[req.id] ?? 0) >= req.rank)) {
    return `Requiere ${def.requiresAny.map((req) => `${skillNode(req.id)?.name ?? req.id} ${req.rank}`).join(' o ')}`
  }
  return null
}

/** Combined stat bonus from every rank bought in the tree. */
export function metaMods(purchased: Record<string, number>): StatMods {
  migrateSkillTree(purchased)
  const mods: StatMods = {}
  for (const def of SKILL_NODES) {
    const rank = Math.min(Math.max(0, purchased[def.id] ?? 0), def.maxRank)
    for (const key of Object.keys(def.perRank) as StatKey[]) {
      mods[key] = (mods[key] ?? 0) + (def.perRank[key] ?? 0) * rank
    }
  }
  return mods
}
