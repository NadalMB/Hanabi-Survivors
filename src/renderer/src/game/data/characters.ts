import type { StatMods } from './stats'
import { WEAPONS } from './weapons'

export type Accessory = 'flower' | 'ribbon' | 'headband' | 'fox-ears' | 'twin-tails' | 'ponytail'

/** Signature item drawn on the sprite so each character reads at a glance. */
export type CharacterProp = 'katana' | 'gohei' | 'scarf' | 'fox-tail' | 'drums' | 'rocket'

/** Extra motif painted on a skin's outfit so it reads as its own costume. */
export type OutfitPattern = 'stars' | 'flames' | 'waves' | 'stripes' | 'blossoms' | 'scales'

export interface CharacterPalette {
  hair: string
  hairShade: string
  eyes: string
  eyesDark: string
  outfit: string
  outfitShade: string
  accent: string
}

export interface CharacterDef {
  id: string
  name: string
  title: string
  description: string
  weapon: string
  mods: StatMods
  palette: CharacterPalette
  accessories: readonly Accessory[]
  prop: CharacterProp
  longHair: boolean
  pattern?: OutfitPattern
  /** Skin rarity. Base characters leave this empty. */
  tier?: 'rare' | 'epic' | 'legendary' | 'exclusive'
  /** Gold needed to unlock in the shop (0 = available from the start). */
  unlockCost: number
  /** World index that must be reached before the heroine, her bonus and her weapons are shown. */
  revealWorld?: number
  /** Two common starters. When omitted, the base weapon and its common prestige are used. */
  starters?: readonly [string, string]
}

export const CHARACTERS: Record<string, CharacterDef> = {
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    title: 'Espadachina del Cerezo',
    description: 'Empieza con el Abanico Carmesí. +10% de poder.',
    weapon: 'katana',
    mods: { might: 0.1 },
    palette: { hair: '#ff8fc0', hairShade: '#d9578f', eyes: '#ff6fae', eyesDark: '#8f1650', outfit: '#fdeef6', outfitShade: '#e6a9c9', accent: '#ff4f98' },
    accessories: ['flower'],
    prop: 'katana',
    longHair: false,
    unlockCost: 0
  },
  rin: {
    id: 'rin',
    name: 'Rin',
    title: 'Miko del Santuario',
    description: 'Empieza con el Ofuda Sagrado. -10% de enfriamiento.',
    weapon: 'talisman',
    mods: { cooldown: -0.1 },
    palette: { hair: '#3a2f5c', hairShade: '#211a38', eyes: '#ff5470', eyesDark: '#7a1424', outfit: '#f6f3ff', outfitShade: '#d8243c', accent: '#d8243c' },
    accessories: ['ribbon'],
    prop: 'gohei',
    longHair: true,
    unlockCost: 650
  },
  kaede: {
    id: 'kaede',
    name: 'Kaede',
    title: 'Kunoichi del Crepúsculo',
    description: 'Empieza con Kunais. +15% de velocidad.',
    weapon: 'kunai',
    mods: { moveSpeed: 0.15 },
    palette: { hair: '#8b6cff', hairShade: '#5338c9', eyes: '#ffd166', eyesDark: '#a36b00', outfit: '#34315a', outfitShade: '#1d1b33', accent: '#ff5f7e' },
    accessories: ['headband', 'ponytail'],
    prop: 'scarf',
    longHair: false,
    unlockCost: 1050
  },
  yuki: {
    id: 'yuki',
    name: 'Yuki',
    title: 'Kitsune de las Nieves',
    description: 'Empieza con Kitsunebi. +20% de duración.',
    weapon: 'foxfire',
    mods: { duration: 0.2 },
    palette: { hair: '#f2f6ff', hairShade: '#b9c6e6', eyes: '#5fd3ff', eyesDark: '#1f6f9b', outfit: '#8cc0ff', outfitShade: '#4f7fd0', accent: '#5fe3ff' },
    accessories: ['fox-ears'],
    prop: 'fox-tail',
    longHair: true,
    unlockCost: 1550
  },
  hikari: {
    id: 'hikari',
    name: 'Hikari',
    title: 'Sacerdotisa del Trueno',
    description: 'Empieza con el Rayo de Raijin. +15% de suerte.',
    weapon: 'thunder',
    mods: { luck: 0.15 },
    palette: { hair: '#ffe066', hairShade: '#d9a62b', eyes: '#9a8cff', eyesDark: '#3f2f9b', outfit: '#3d438f', outfitShade: '#262a66', accent: '#ffe066' },
    accessories: ['twin-tails'],
    prop: 'drums',
    longHair: false,
    unlockCost: 2100
  },
  akane: {
    id: 'akane',
    name: 'Akane',
    title: 'Maestra Pirotécnica',
    description: 'Empieza con el Cohete Hanabi. +15% de área.',
    weapon: 'hanabi',
    mods: { area: 0.15 },
    palette: { hair: '#ff5a3c', hairShade: '#b8321c', eyes: '#ffb03b', eyesDark: '#9b4a00', outfit: '#2e2342', outfitShade: '#1a1228', accent: '#ff9f1c' },
    accessories: ['ponytail'],
    prop: 'rocket',
    longHair: false,
    unlockCost: 2600
  }
}

export const CHARACTER_ORDER = ['sakura', 'rin', 'kaede', 'yuki', 'hikari', 'akane'] as const

/** True once this save has entered Ceniza Carmesí. */
export function catalogOpen(save: { worldsReached?: number }): boolean {
  return (save.worldsReached ?? 1) >= 2
}

/** A gated heroine stays a silhouette until her world has been reached. */
export function characterRevealed(save: { worldsReached?: number }, id: string): boolean {
  const gate = CHARACTERS[id]?.revealWorld
  return !gate || (save.worldsReached ?? 1) >= gate
}

/** The base weapon, plus a second common only while that form still exists. */
export function starterPair(characterId: string): readonly string[] {
  const declared = CHARACTERS[characterId]?.starters
  if (declared) return declared.filter((id) => WEAPONS[id])
  const base = CHARACTERS[characterId]?.weapon ?? 'katana'
  const alt = `${base}_common`
  return WEAPONS[alt] ? [base, alt] : [base]
}

/** Only the two common forms of that heroine are allowed. Anything else falls back to the base. */
export function resolveStarter(characterId: string, weaponId: string | undefined): string {
  const [base, alt] = starterPair(characterId)
  return weaponId === alt && WEAPONS[alt] ? alt : base
}
