import type { CosmeticLoadout, SaveData } from '@shared/save'
import type { CharacterPalette, OutfitPattern } from './characters'

export type CosmeticKind = 'character_skin' | 'weapon_skin' | 'ornament' | 'pet' | 'effect' | 'profile_icon'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'exclusive'
export type CosmeticSource = 'shop' | 'pass'

export type OrnamentKind = 'halo' | 'crown' | 'lantern' | 'umbrella' | 'horns' | 'wings' | 'moon' | 'mask'
export type PetKind = 'fox' | 'wisp' | 'neko' | 'lantern' | 'dragon' | 'owl' | 'shikigami'
export type EffectKind = 'petals' | 'sparks' | 'snow' | 'embers' | 'stars' | 'lightning'

export interface CosmeticDef {
  id: string
  kind: CosmeticKind
  name: string
  description: string
  rarity: Rarity
  /** Gold price when the daily shop features it. 0 = never sold for gold. */
  price: number
  source: CosmeticSource
  characterId?: string
  weaponId?: string
  palette?: CharacterPalette
  tint?: number
  tint2?: number
  ornament?: OrnamentKind
  pet?: PetKind
  effect?: EffectKind
  pattern?: OutfitPattern
}

export const COSMETICS: Record<string, CosmeticDef> = {
  shikigami: {
    id: 'shikigami',
    kind: 'pet',
    name: 'Shikigami',
    description: 'Un familiar exclusivo. Espíritu alado de cuernos grises que te sigue por la noche.',
    rarity: 'exclusive',
    price: 0,
    source: 'shop',
    pet: 'shikigami'
  },
  avatar_festival: {
    id: 'avatar_festival',
    kind: 'profile_icon',
    name: 'Icono Festival',
    description: 'Retrato chibi del Festival de las Linternas. Se desbloquea en el nivel 10 del pase gratuito.',
    rarity: 'rare',
    price: 0,
    source: 'pass'
  }
}

export const COSMETIC_ORDER = Object.keys(COSMETICS)

export const KIND_LABEL: Record<CosmeticKind, string> = {
  character_skin: 'Skins de heroína',
  weapon_skin: 'Skins de arma',
  ornament: 'Adornos',
  pet: 'Mascotas',
  effect: 'Efectos',
  profile_icon: 'Iconos de perfil'
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Legendario',
  exclusive: 'Exclusivo'
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#c5cce0',
  rare: '#5fd3ff',
  epic: '#c084fc',
  legendary: '#ffd166',
  exclusive: '#ff6b9a'
}

export const WEAPON_FAMILY: Record<string, string> = {
  katana: 'katana',
  senbonzakura: 'katana',
  talisman: 'talisman',
  hundred_seals: 'talisman',
  kunai: 'kunai',
  kunai_storm: 'kunai',
  foxfire: 'foxfire',
  nine_tails: 'foxfire',
  thunder: 'thunder',
  raijin_wrath: 'thunder',
  aura: 'aura',
  sanctuary: 'aura',
  shuriken: 'shuriken',
  fuuma: 'shuriken',
  hanabi: 'hanabi',
  grand_finale: 'hanabi'
}

/** Base look first, then every painted skin of that heroine. */
export function skinsFor(characterId: string): { id: string; name: string; rarity: Rarity | null }[] {
  const extras = COSMETIC_ORDER.map((id) => COSMETICS[id]).filter(
    (c) => c.kind === 'character_skin' && c.characterId === characterId
  )
  return [
    { id: characterId, name: 'Clásica', rarity: null },
    ...extras.map((c) => ({ id: c.id, name: c.name, rarity: c.rarity }))
  ]
}

export function cosmeticsOf(kind: CosmeticKind): CosmeticDef[] {
  return COSMETIC_ORDER.map((id) => COSMETICS[id]).filter((c) => c.kind === kind)
}

export function shopPool(): CosmeticDef[] {
  return COSMETIC_ORDER.map((id) => COSMETICS[id]).filter((c) => c.source === 'shop' && c.price > 0)
}

export function ownsCosmetic(save: SaveData, id: string): boolean {
  return save.ownedCosmetics.includes(id)
}

export function equippedCharacterKey(save: SaveData, characterId: string): string {
  return save.equipped.characterSkins[characterId] ?? characterId
}

export function loadoutFromSave(save: SaveData): CosmeticLoadout {
  return {
    characterSkins: { ...save.equipped.characterSkins },
    weaponSkins: { ...save.equipped.weaponSkins },
    ornament: save.equipped.ornament,
    pet: save.equipped.pet,
    effect: save.equipped.effect,
    avatar: save.equipped.avatar
  }
}

/** Preview URL for the equipped profile icon, or null when none is set. */
export function equippedAvatarUrl(save: SaveData, previews: Record<string, string>): string | null {
  const id = save.equipped.avatar
  if (!id || !ownsCosmetic(save, id) || COSMETICS[id]?.kind !== 'profile_icon') return null
  return previews[id] ?? null
}

export function playerSkinKey(loadout: CosmeticLoadout | undefined, characterId: string): string {
  const id = loadout?.characterSkins[characterId]
  const skin = id ? COSMETICS[id] : undefined
  if (skin?.kind === 'character_skin' && skin.characterId === characterId) return id as string
  return characterId
}

export function weaponSkinFor(loadout: CosmeticLoadout | undefined, weaponId: string): CosmeticDef | undefined {
  const family = WEAPON_FAMILY[weaponId] ?? weaponId
  const id = loadout?.weaponSkins[family]
  return id ? COSMETICS[id] : undefined
}

export function grantCosmetic(save: SaveData, id: string): boolean {
  if (!COSMETICS[id] || save.ownedCosmetics.includes(id)) return false
  save.ownedCosmetics.push(id)
  if (COSMETICS[id].kind === 'profile_icon' && !save.equipped.avatar) save.equipped.avatar = id
  return true
}

export function isEquipped(save: SaveData, id: string): boolean {
  const c = COSMETICS[id]
  if (!c) return false
  if (c.kind === 'character_skin' && c.characterId) return save.equipped.characterSkins[c.characterId] === id
  if (c.kind === 'weapon_skin' && c.weaponId) return save.equipped.weaponSkins[c.weaponId] === id
  if (c.kind === 'ornament') return save.equipped.ornament === id
  if (c.kind === 'pet') return save.equipped.pet === id
  if (c.kind === 'effect') return save.equipped.effect === id
  if (c.kind === 'profile_icon') return save.equipped.avatar === id
  return false
}

export function equipCosmetic(save: SaveData, id: string): void {
  const c = COSMETICS[id]
  if (!c || !save.ownedCosmetics.includes(id)) return
  if (c.kind === 'character_skin' && c.characterId) save.equipped.characterSkins[c.characterId] = id
  else if (c.kind === 'weapon_skin' && c.weaponId) save.equipped.weaponSkins[c.weaponId] = id
  else if (c.kind === 'ornament') save.equipped.ornament = id
  else if (c.kind === 'pet') save.equipped.pet = id
  else if (c.kind === 'effect') save.equipped.effect = id
  else if (c.kind === 'profile_icon') save.equipped.avatar = id
}

export function unequipCosmetic(save: SaveData, id: string): void {
  const c = COSMETICS[id]
  if (!c) return
  if (c.kind === 'character_skin' && c.characterId && save.equipped.characterSkins[c.characterId] === id) {
    delete save.equipped.characterSkins[c.characterId]
  } else if (c.kind === 'weapon_skin' && c.weaponId && save.equipped.weaponSkins[c.weaponId] === id) {
    delete save.equipped.weaponSkins[c.weaponId]
  } else if (c.kind === 'ornament' && save.equipped.ornament === id) save.equipped.ornament = null
  else if (c.kind === 'pet' && save.equipped.pet === id) save.equipped.pet = null
  else if (c.kind === 'effect' && save.equipped.effect === id) save.equipped.effect = null
  else if (c.kind === 'profile_icon' && save.equipped.avatar === id) save.equipped.avatar = null
}
