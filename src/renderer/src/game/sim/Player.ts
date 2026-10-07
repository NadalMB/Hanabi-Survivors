import { emptyLoadout, type CosmeticLoadout } from '@shared/save'
import type { PlayerId, UpgradeChoice } from '@shared/protocol'
import { CHARACTERS, resolveStarter, type CharacterDef } from '../data/characters'
import { PASSIVES } from '../data/passives'
import { addMods, BASE_STATS, type PlayerStats, type StatMods } from '../data/stats'
import { emptyPrestige } from '../data/prestige'
import { computeWeaponStats, WEAPONS, type WeaponStats } from '../data/weapons'

/** Speed kept while chilled. Noticeable, but you can still walk out of the aura. */
export const CHILL_SPEED = 0.72

export interface WeaponSlot {
  id: string
  level: number
  cooldown: number
  burstLeft: number
  burstTimer: number
  /** Index of the current shot within a volley. */
  shot: number
  /** Rare, epic and legendary level-up stacks, indexed like PRESTIGE_ORDER. */
  prestige: [number, number, number, number]
  stats: WeaponStats
}

export interface PassiveSlot {
  id: string
  level: number
  /** Equals level. Kept on the wire so a rarity that grants several levels stays in sync. */
  power: number
}

export class Player {
  x = 0
  y = 0
  prevX = 0
  prevY = 0
  moveX = 0
  moveY = 0
  /** Last non-zero movement direction, used by directional weapons. */
  aimX = 1
  aimY = 0
  facing = 1
  hp = 0
  alive = true
  iframes = 0
  revivalsLeft = 0
  /** Seconds a teammate has spent reviving this (downed) player. */
  reviveProgress = 0
  disconnected = false
  stats: PlayerStats = { ...BASE_STATS }
  readonly weapons: WeaponSlot[] = []
  readonly passives: PassiveSlot[] = []
  pendingLevelUps = 0
  choices: UpgradeChoice[] | null = null
  /** Whether the open choice is a level-up or a chest. */
  offer: 'level' | 'chest' | null = null
  /** Chests collected while another choice was already on screen. */
  pendingChests = 0
  /** World positions of pending personal chests (same order as pendingChests). */
  readonly pendingChestPos: { x: number; y: number }[] = []
  /** This player still has to open their half of a shared co-op chest. */
  awaitingChest = false
  kills = 0
  damageDealt = 0
  lastInputSeq = 0
  /** Seconds of Yuki-onna's chill still left. Movement is slowed while this is above zero. */
  chill = 0
  readonly character: CharacterDef
  readonly loadout: CosmeticLoadout
  /** Weapon chosen before the run. A new world hands it back at level 1. */
  readonly starterWeapon: string

  constructor(
    readonly id: PlayerId,
    readonly index: number,
    readonly name: string,
    characterId: string,
    private readonly metaMods: StatMods,
    loadout?: CosmeticLoadout,
    weaponId?: string
  ) {
    this.character = CHARACTERS[characterId] ?? CHARACTERS.sakura
    this.loadout = loadout ?? emptyLoadout()
    this.starterWeapon = resolveStarter(this.character.id, weaponId)
    this.recomputeStats()
    this.hp = this.stats.maxHp
    this.revivalsLeft = Math.round(this.stats.revival)
    this.addWeapon(this.starterWeapon)
  }

  /** Drop the run build and start again with the chosen common weapon. */
  resetBuild(): void {
    this.weapons.length = 0
    this.passives.length = 0
    this.pendingLevelUps = 0
    this.choices = null
    this.offer = null
    this.pendingChests = 0
    this.pendingChestPos.length = 0
    this.awaitingChest = false
    this.chill = 0
    this.recomputeStats()
    this.hp = this.stats.maxHp
    this.revivalsLeft = Math.round(this.stats.revival)
    this.addWeapon(this.starterWeapon)
  }

  recomputeStats(): void {
    const prevMax = this.stats.maxHp
    const s: PlayerStats = { ...BASE_STATS }
    addMods(s, this.character.mods)
    addMods(s, this.metaMods)
    for (const p of this.passives) addMods(s, PASSIVES[p.id].perLevel, p.power)
    this.stats = s
    if (s.maxHp > prevMax) this.hp += s.maxHp - prevMax
    this.hp = Math.min(this.hp, s.maxHp)
    for (const w of this.weapons) this.refreshWeapon(w)
  }

  refreshWeapon(w: WeaponSlot): void {
    const def = WEAPONS[w.id]
    if (!def) return
    w.stats = computeWeaponStats(def, w.level, this.stats, w.prestige)
  }

  weapon(id: string): WeaponSlot | undefined {
    return this.weapons.find((w) => w.id === id)
  }

  passive(id: string): PassiveSlot | undefined {
    return this.passives.find((p) => p.id === id)
  }

  addWeapon(id: string): void {
    if (!WEAPONS[id]) return
    this.weapons.push({
      id,
      level: 1,
      cooldown: 0.4,
      burstLeft: 0,
      burstTimer: 0,
      shot: 0,
      prestige: emptyPrestige(),
      stats: computeWeaponStats(WEAPONS[id], 1, this.stats)
    })
  }

  addPassive(id: string): void {
    this.passives.push({ id, level: 1, power: 1 })
    this.recomputeStats()
  }

  heal(amount: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount)
  }
}
