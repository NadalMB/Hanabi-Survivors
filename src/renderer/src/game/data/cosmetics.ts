import type { CosmeticLoadout, SaveData } from '@shared/save'
import type { CharacterPalette, OutfitPattern } from './characters'

export type CosmeticKind = 'character_skin' | 'weapon_skin' | 'ornament' | 'pet' | 'effect'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'exclusive'
export type CosmeticSource = 'shop' | 'pass'

export type OrnamentKind = 'halo' | 'crown' | 'lantern' | 'umbrella' | 'horns' | 'wings' | 'moon' | 'mask'
export type PetKind = 'fox' | 'wisp' | 'neko' | 'lantern' | 'dragon' | 'owl'
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

const skin = (
  id: string,
  characterId: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number,
  source: CosmeticSource,
  palette: CharacterPalette,
  pattern?: OutfitPattern
): CosmeticDef => ({ id, kind: 'character_skin', characterId, name, description, rarity, price, source, palette, pattern })

const wskin = (
  id: string,
  weaponId: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number,
  source: CosmeticSource,
  tint: number,
  tint2?: number
): CosmeticDef => ({ id, kind: 'weapon_skin', weaponId, name, description, rarity, price, source, tint, tint2 })

const ornament = (
  id: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number,
  source: CosmeticSource,
  kind: OrnamentKind,
  tint: number
): CosmeticDef => ({ id, kind: 'ornament', name, description, rarity, price, source, ornament: kind, tint })

const pet = (
  id: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number,
  source: CosmeticSource,
  kind: PetKind,
  tint: number
): CosmeticDef => ({ id, kind: 'pet', name, description, rarity, price, source, pet: kind, tint })

const effect = (
  id: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number,
  source: CosmeticSource,
  kind: EffectKind,
  tint: number,
  tint2?: number
): CosmeticDef => ({ id, kind: 'effect', name, description, rarity, price, source, effect: kind, tint, tint2 })

export const COSMETICS: Record<string, CosmeticDef> = {
  sakura_midnight: skin('sakura_midnight', 'sakura', 'Medianoche', 'Kimono de tinta, estrellas y pelo de amatista.', 'rare', 900, 'shop', {
    hair: '#6b4cff', hairShade: '#3a1f9a', eyes: '#c9a8ff', eyesDark: '#3d1a7a', outfit: '#1c1233', outfitShade: '#0c0718', accent: '#8f6bff'
  }, 'stars'),
  sakura_shrine: skin('sakura_shrine', 'sakura', 'Sacerdotisa Dorada', 'Blancos ceremoniales y oro de santuario.', 'epic', 1800, 'shop', {
    hair: '#fff4c8', hairShade: '#d4b45a', eyes: '#ffb03b', eyesDark: '#8a4a00', outfit: '#fff8ee', outfitShade: '#e8d2a0', accent: '#e0a020'
  }),
  sakura_celestial: skin('sakura_celestial', 'sakura', 'Cerezo Celestial', 'Pétalos de constelación. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#ffb7e0', hairShade: '#c45aa0', eyes: '#9ef6ff', eyesDark: '#1c6a80', outfit: '#2a1648', outfitShade: '#120820', accent: '#7ef0ff'
  }),
  rin_ocean: skin('rin_ocean', 'rin', 'Marea del Santuario', 'Azules de estanque sagrado.', 'rare', 950, 'shop', {
    hair: '#1c3f7a', hairShade: '#0c2048', eyes: '#4fd4ff', eyesDark: '#0d4a70', outfit: '#e8f4ff', outfitShade: '#2a6cb0', accent: '#3aa0e8'
  }),
  rin_oni: skin('rin_oni', 'rin', 'Oni Carmesí', 'Escarlata de máscara oni.', 'epic', 1900, 'shop', {
    hair: '#1a0c14', hairShade: '#080408', eyes: '#ff3048', eyesDark: '#6a0818', outfit: '#2a0810', outfitShade: '#4a1018', accent: '#ff2038'
  }),
  rin_shadowmiko: skin('rin_shadowmiko', 'rin', 'Miko de Sombra', 'Sellos negros y ojos de luna. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#c9b8ff', hairShade: '#6a58b0', eyes: '#e8f0ff', eyesDark: '#3a4060', outfit: '#14101c', outfitShade: '#08060c', accent: '#b49cff'
  }),
  kaede_moon: skin('kaede_moon', 'kaede', 'Luz de Luna', 'Plateado de tejado nocturno.', 'rare', 1000, 'shop', {
    hair: '#d4d8f0', hairShade: '#7a80a8', eyes: '#8fd4ff', eyesDark: '#204868', outfit: '#2a3048', outfitShade: '#12162a', accent: '#c0d4ff'
  }),
  kaede_venom: skin('kaede_venom', 'kaede', 'Veneno de Wisteria', 'Verde tóxico de kunoichi.', 'epic', 2000, 'shop', {
    hair: '#3cff8a', hairShade: '#148848', eyes: '#c8ff4a', eyesDark: '#3a6808', outfit: '#102018', outfitShade: '#08100c', accent: '#7dff4a'
  }),
  kaede_phantom: skin('kaede_phantom', 'kaede', 'Fantasma del Crepúsculo', 'Silueta de niebla. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#a890ff', hairShade: '#4a2880', eyes: '#ff90d0', eyesDark: '#801848', outfit: '#180828', outfitShade: '#080410', accent: '#ff6ad0'
  }),
  yuki_blossom: skin('yuki_blossom', 'yuki', 'Kitsune en Flor', 'Rosa de ciruelo sobre nieve.', 'rare', 1100, 'shop', {
    hair: '#ffd0e8', hairShade: '#e090b8', eyes: '#ff6fae', eyesDark: '#8f1650', outfit: '#fff0f6', outfitShade: '#f0a0c0', accent: '#ff6fae'
  }),
  yuki_void: skin('yuki_void', 'yuki', 'Zorro del Vacío', 'Azul abismo y fuego frío.', 'epic', 2200, 'shop', {
    hair: '#1a2448', hairShade: '#0a1028', eyes: '#7a5cff', eyesDark: '#281868', outfit: '#14182a', outfitShade: '#080810', accent: '#6a4cff'
  }),
  yuki_aurora: skin('yuki_aurora', 'yuki', 'Aurora de Nueve Colas', 'Verde boreal. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#c8fff0', hairShade: '#48c0b0', eyes: '#5cffc0', eyesDark: '#106048', outfit: '#102830', outfitShade: '#081418', accent: '#4affc8'
  }),
  hikari_ivory: skin('hikari_ivory', 'hikari', 'Marfil del Trueno', 'Blancos de nube de tormenta.', 'rare', 1200, 'shop', {
    hair: '#fff8e0', hairShade: '#d0c090', eyes: '#6a80ff', eyesDark: '#202868', outfit: '#f4f0e8', outfitShade: '#3a4888', accent: '#8090ff'
  }),
  hikari_sunset: skin('hikari_sunset', 'hikari', 'Ocaso de Raijin', 'Naranja de atardecer sobre el taiko.', 'epic', 2100, 'shop', {
    hair: '#ff8040', hairShade: '#b04018', eyes: '#ffd040', eyesDark: '#805008', outfit: '#401820', outfitShade: '#200810', accent: '#ff6030'
  }),
  hikari_raijin: skin('hikari_raijin', 'hikari', 'Avatar de Raijin', 'Rayo vivo. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#fff06a', hairShade: '#c8a020', eyes: '#ffffff', eyesDark: '#3050a0', outfit: '#1a1a48', outfitShade: '#080820', accent: '#ffe040'
  }),
  akane_jade: skin('akane_jade', 'akane', 'Pirotécnica de Jade', 'Verde festival y chispas.', 'rare', 1300, 'shop', {
    hair: '#30c878', hairShade: '#147040', eyes: '#c8ff80', eyesDark: '#386010', outfit: '#102418', outfitShade: '#08100c', accent: '#40e090'
  }),
  akane_royal: skin('akane_royal', 'akane', 'Maestra Imperial', 'Púrpura de corte y oro.', 'epic', 2400, 'shop', {
    hair: '#8a30c8', hairShade: '#4a1070', eyes: '#ffd060', eyesDark: '#805808', outfit: '#2a1040', outfitShade: '#140820', accent: '#d4a020'
  }),
  akane_empress: skin('akane_empress', 'akane', 'Emperatriz Hanabi', 'Fuego blanco de gran final. Solo en el pase.', 'exclusive', 0, 'pass', {
    hair: '#ffd0e0', hairShade: '#e06090', eyes: '#fff0a0', eyesDark: '#a05010', outfit: '#200818', outfitShade: '#100410', accent: '#ff4090'
  }),

  katana_crimson: wskin('katana_crimson', 'katana', 'Filo Carmesí', 'La hoja bebe cerezo oscuro.', 'rare', 800, 'shop', 0xff3a5a, 0xff8aa0),
  katana_moon: wskin('katana_moon', 'katana', 'Acero Lunar', 'Cortes de plata fría.', 'epic', 1600, 'shop', 0xb8d4ff, 0x6a90e0),
  katana_phoenix: wskin('katana_phoenix', 'katana', 'Katana Fénix', 'Llamas al desenvainar. Solo en el pase.', 'exclusive', 0, 'pass', 0xff9a3a, 0xffe066),
  talisman_gold: wskin('talisman_gold', 'talisman', 'Sellos Dorados', 'Ofuda de oro de templo.', 'rare', 750, 'shop', 0xffd166, 0xfff3c4),
  talisman_ink: wskin('talisman_ink', 'talisman', 'Tinta Maldita', 'Papel negro y kanji rojo.', 'epic', 1500, 'shop', 0x2a1a3a, 0xff4060),
  talisman_divine: wskin('talisman_divine', 'talisman', 'Cien Sellos Divinos', 'Luz de altar. Solo en el pase.', 'exclusive', 0, 'pass', 0xffffff, 0x9ef6ff),
  kunai_poison: wskin('kunai_poison', 'kunai', 'Kunai Venenoso', 'Filo empapado en wisteria.', 'rare', 700, 'shop', 0x6dff4a, 0x1a8028),
  kunai_gold: wskin('kunai_gold', 'kunai', 'Kunai Imperial', 'Acero chapado.', 'epic', 1400, 'shop', 0xffd166, 0xc09020),
  foxfire_azure: wskin('foxfire_azure', 'foxfire', 'Fuego Azur', 'Llamas de estanque sagrado.', 'rare', 850, 'shop', 0x5fd3ff, 0x2a80d0),
  foxfire_rose: wskin('foxfire_rose', 'foxfire', 'Kitsunebi Rosa', 'Fuego de flor de ciruelo.', 'epic', 1700, 'shop', 0xff6fae, 0xffc0d8),
  foxfire_ninefold: wskin('foxfire_ninefold', 'foxfire', 'Nueve Colas Eternas', 'Anillo de aurora. Solo en el pase.', 'exclusive', 0, 'pass', 0x4affc8, 0xc8fff0),
  thunder_gold: wskin('thunder_gold', 'thunder', 'Rayo de Oro', 'Tambor imperial.', 'rare', 900, 'shop', 0xffe066, 0xffaa20),
  thunder_crimson: wskin('thunder_crimson', 'thunder', 'Tormenta Carmesí', 'Ira roja de Raijin.', 'epic', 1750, 'shop', 0xff4060, 0xff90a0),
  aura_jade: wskin('aura_jade', 'aura', 'Barrera de Jade', 'Círculo de templo musgoso.', 'rare', 800, 'shop', 0x40e090, 0x148848),
  aura_blood: wskin('aura_blood', 'aura', 'Santuario Escarlata', 'Aura que late como un corazón.', 'epic', 1650, 'shop', 0xff4f7b, 0xa01030),
  shuriken_ice: wskin('shuriken_ice', 'shuriken', 'Shuriken de Hielo', 'Cristales de escarcha que giran en lugar del acero.', 'rare', 750, 'shop', 0xb8f0ff, 0x48b0e0),
  shuriken_neon: wskin('shuriken_neon', 'shuriken', 'Fūma Neón', 'Estrella de tubo de neón rosa y cian.', 'epic', 1550, 'shop', 0xff5fa2, 0x8f6bff),
  shuriken_pizza: wskin('shuriken_pizza', 'shuriken', 'Shuriken Pizza', 'Pizzas enteras, con pepperoni, que vuelan y regresan.', 'epic', 2100, 'shop', 0xffb03b, 0xd8243c),
  hanabi_star: wskin('hanabi_star', 'hanabi', 'Cohete Estelar', 'Pólvora de constelación.', 'rare', 950, 'shop', 0x9ef6ff, 0xffd166),
  hanabi_oni: wskin('hanabi_oni', 'hanabi', 'Hanabi Oni', 'Estallidos de máscara roja.', 'epic', 1900, 'shop', 0xff3a20, 0xffd040),
  hanabi_galaxy: wskin('hanabi_galaxy', 'hanabi', 'Gran Final Galáctico', 'Una noche entera en un cohete. Solo en el pase.', 'exclusive', 0, 'pass', 0x8f6bff, 0xffd0ff),

  halo: ornament('halo', 'Aureola de Santuario', 'Un anillo de luz sobre la cabeza.', 'rare', 1200, 'shop', 'halo', 0xffe066),
  crown: ornament('crown', 'Corona de Festival', 'Adorno imperial de papel dorado.', 'epic', 2200, 'shop', 'crown', 0xffd166),
  lantern_orb: ornament('lantern_orb', 'Linterna Flotante', 'Una chochin que te sigue a un palmo.', 'rare', 1100, 'shop', 'lantern', 0xff8a3b),
  umbrella: ornament('umbrella', 'Parasol de Papel', 'Wagasa rosa contra la horda.', 'epic', 2000, 'shop', 'umbrella', 0xff6fae),
  horns: ornament('horns', 'Cuernos de Oni', 'Pequeños cuernos lacados.', 'rare', 1000, 'shop', 'horns', 0xff4060),
  spirit_wings: ornament('spirit_wings', 'Alas de Espíritu', 'Plumas de zorro celestial. Solo en el pase.', 'exclusive', 0, 'pass', 'wings', 0xffc0e8),
  moon_disk: ornament('moon_disk', 'Disco Lunar', 'Una luna llena a tu espalda. Solo en el pase.', 'exclusive', 0, 'pass', 'moon', 0xffe8c8),
  fox_mask: ornament('fox_mask', 'Máscara Kitsune', 'La cara del festival. Solo en el pase.', 'exclusive', 0, 'pass', 'mask', 0xfff4e0),

  fox_kit: pet('fox_kit', 'Cría Kitsune', 'Un zorrito que te sigue a unos pasos.', 'rare', 1600, 'shop', 'fox', 0xff8a3b),
  will_wisp: pet('will_wisp', 'Fuego Fatuo', 'Una llama que flota detrás de ti.', 'common', 700, 'shop', 'wisp', 0x5ff2ff),
  lucky_neko: pet('lucky_neko', 'Neko de la Suerte', 'Te sigue correteando.', 'epic', 2400, 'shop', 'neko', 0xffd166),
  paper_chochin: pet('paper_chochin', 'Chochin de Papel', 'Linterna que va detrás, con patitas invisibles.', 'rare', 1400, 'shop', 'lantern', 0xff9f1c),
  mini_dragon: pet('mini_dragon', 'Dragón de Bolsillo', 'Un ryū en miniatura. Solo en el pase.', 'exclusive', 0, 'pass', 'dragon', 0x40e090),
  snow_owl: pet('snow_owl', 'Búho de las Nieves', 'Vigila la noche. Solo en el pase.', 'exclusive', 0, 'pass', 'owl', 0xe8f4ff),

  cherry_trail: effect('cherry_trail', 'Estela de Pétalos', 'Dejas cerezo al correr.', 'common', 600, 'shop', 'petals', 0xff8fc0, 0xffd6ea),
  spark_burst: effect('spark_burst', 'Chispas de Yunque', 'Golpes que echan estrellas.', 'rare', 1100, 'shop', 'sparks', 0xffd166, 0xffffff),
  snowfall: effect('snowfall', 'Nevada Suave', 'Copos a tu alrededor.', 'rare', 1200, 'shop', 'snow', 0xe8f4ff, 0xb8d4ff),
  ember_wake: effect('ember_wake', 'Estela de Ascuas', 'Brasas que siguen tus pasos.', 'epic', 1800, 'shop', 'embers', 0xff6a30, 0xffd040),
  star_dust: effect('star_dust', 'Polvo de Estrellas', 'Constelaciones al nivelar. Solo en el pase.', 'exclusive', 0, 'pass', 'stars', 0xffe066, 0x9ef6ff),
  thunder_veil: effect('thunder_veil', 'Velo de Trueno', 'Arcos eléctricos al moverte. Solo en el pase.', 'exclusive', 0, 'pass', 'lightning', 0x9ef6ff, 0xffe066)
}

const SKIN_PATTERNS: Record<string, OutfitPattern> = {
  sakura_midnight: 'stars',
  sakura_shrine: 'blossoms',
  sakura_celestial: 'stars',
  rin_ocean: 'waves',
  rin_oni: 'flames',
  rin_shadowmiko: 'stripes',
  kaede_moon: 'waves',
  kaede_venom: 'scales',
  kaede_phantom: 'stars',
  yuki_blossom: 'blossoms',
  yuki_void: 'stars',
  yuki_aurora: 'waves',
  hikari_ivory: 'stripes',
  hikari_sunset: 'flames',
  hikari_raijin: 'flames',
  akane_jade: 'scales',
  akane_royal: 'stripes',
  akane_empress: 'flames'
}
for (const [id, pattern] of Object.entries(SKIN_PATTERNS)) COSMETICS[id].pattern = pattern

export const COSMETIC_ORDER = Object.keys(COSMETICS)

export const KIND_LABEL: Record<CosmeticKind, string> = {
  character_skin: 'Skins de heroína',
  weapon_skin: 'Skins de arma',
  ornament: 'Adornos',
  pet: 'Mascotas',
  effect: 'Efectos'
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

export function cosmeticsOf(kind: CosmeticKind): CosmeticDef[] {
  return COSMETIC_ORDER.map((id) => COSMETICS[id]).filter((c) => c.kind === kind)
}

export function shopPool(): CosmeticDef[] {
  return COSMETIC_ORDER.map((id) => COSMETICS[id]).filter((c) => c.source === 'shop')
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
    effect: save.equipped.effect
  }
}

export function playerSkinKey(loadout: CosmeticLoadout | undefined, characterId: string): string {
  return loadout?.characterSkins[characterId] ?? characterId
}

export function weaponSkinFor(loadout: CosmeticLoadout | undefined, weaponId: string): CosmeticDef | undefined {
  const family = WEAPON_FAMILY[weaponId] ?? weaponId
  const id = loadout?.weaponSkins[family]
  return id ? COSMETICS[id] : undefined
}

export function grantCosmetic(save: SaveData, id: string): boolean {
  if (!COSMETICS[id] || save.ownedCosmetics.includes(id)) return false
  save.ownedCosmetics.push(id)
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
}
