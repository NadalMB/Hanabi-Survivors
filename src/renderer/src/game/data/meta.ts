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

/**
 * Four branches.
 * Acero is how hard you hit. Santuario is how long you last.
 * Viento is movement and the spoils of a run. Hanabi shapes the weapons,
 * and it opens once you have started either Acero or Viento.
 */
export const SKILL_NODES: readonly SkillNodeDef[] = [
  node('filo', 'Filo', 'crossed_swords', { might: 0.05 }, 5),
  node('tempo', 'Tempo', 'hourglass', { cooldown: -0.015 }, 4, { requires: [{ id: 'filo', rank: 2 }] }),
  node('mira', 'Mira', 'omamori', { luck: 0.05 }, 4, { requires: [{ id: 'filo', rank: 2 }] }),
  node('rafaga', 'Ráfaga', 'mirror', { amount: 1 }, 1, { costs: [4], requires: [{ id: 'tempo', rank: 2 }, { id: 'mira', rank: 2 }] }),

  node('vitalidad', 'Vitalidad', 'heart', { maxHp: 12 }, 5),
  node('coraza', 'Coraza', 'armor', { armor: 1 }, 3, { requires: [{ id: 'vitalidad', rank: 2 }] }),
  node('aliento', 'Aliento', 'tea', { recovery: 0.12 }, 4, { requires: [{ id: 'vitalidad', rank: 2 }] }),
  node('renacer', 'Renacer', 'phoenix', { revival: 1 }, 1, { costs: [5], requires: [{ id: 'coraza', rank: 2 }, { id: 'aliento', rank: 2 }] }),

  node('agilidad', 'Agilidad', 'leaf', { moveSpeed: 0.04 }, 4),
  node('iman', 'Imán', 'bell', { magnet: 0.06 }, 4, { requires: [{ id: 'agilidad', rank: 1 }] }),
  node('sabiduria', 'Sabiduría', 'book', { growth: 0.035 }, 4, { requires: [{ id: 'agilidad', rank: 2 }] }),
  node('codicia', 'Codicia', 'coin', { greed: 0.1 }, 5, { requires: [{ id: 'iman', rank: 2 }] }),

  node('amplitud', 'Amplitud', 'crystal', { area: 0.05 }, 3, { requiresAny: [{ id: 'filo', rank: 1 }, { id: 'agilidad', rank: 1 }] }),
  node('impulso', 'Impulso', 'feather', { speed: 0.05 }, 3, { requires: [{ id: 'amplitud', rank: 2 }] }),
  node('persistencia', 'Persistencia', 'lantern', { duration: 0.05 }, 3, { requires: [{ id: 'impulso', rank: 2 }] })
]

const BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]))

export interface SkillBranch {
  id: string
  name: string
  kicker: string
  text: string
  /** Each inner list is one row. Several ids in a row are siblings. */
  rows: readonly (readonly string[])[]
}

export const SKILL_BRANCHES: readonly SkillBranch[] = [
  {
    id: 'acero',
    name: 'Acero',
    kicker: 'Ofensiva',
    text: 'Primero pegas más fuerte. Luego atacas antes y con más suerte. Al fondo, un proyectil extra.',
    rows: [['filo'], ['tempo', 'mira'], ['rafaga']]
  },
  {
    id: 'santuario',
    name: 'Santuario',
    kicker: 'Supervivencia',
    text: 'Más vida abre la coraza y el aliento. Las dos juntas despiertan el renacer.',
    rows: [['vitalidad'], ['coraza', 'aliento'], ['renacer']]
  },
  {
    id: 'viento',
    name: 'Viento',
    kicker: 'Botín',
    text: 'Correr más abre el imán y la experiencia. Quien atrae más oro, lo multiplica.',
    rows: [['agilidad'], ['iman', 'sabiduria'], ['codicia']]
  },
  {
    id: 'hanabi',
    name: 'Hanabi',
    kicker: 'Armas',
    text: 'Se enciende al dar el primer paso en Acero o en Viento. El ataque crece, vuela y dura.',
    rows: [['amplitud'], ['impulso'], ['persistencia']]
  }
]

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
  const mods: StatMods = {}
  for (const def of SKILL_NODES) {
    const rank = Math.min(Math.max(0, purchased[def.id] ?? 0), def.maxRank)
    for (const key of Object.keys(def.perRank) as StatKey[]) {
      mods[key] = (mods[key] ?? 0) + (def.perRank[key] ?? 0) * rank
    }
  }
  return mods
}
