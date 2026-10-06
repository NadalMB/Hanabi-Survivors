import { accountXpForRun } from './account'

export const SAVE_VERSION = 2
export const BATTLE_PASS_SEASON = 1

export interface SaveSettings {
  masterVolume: number
  musicVolume: number
  /** When false the soundtrack stays silent and the volume slider is remembered. */
  musicEnabled: boolean
  sfxVolume: number
  screenShake: number
  damageNumbers: boolean
  fullscreen: boolean
  /** Set when the player uses the fullscreen toggle. Older saves stay on the default. */
  fullscreenChosen?: boolean
  playerName: string
}

export interface CosmeticLoadout {
  characterSkins: Record<string, string>
  weaponSkins: Record<string, string>
  ornament: string | null
  pet: string | null
  effect: string | null
}

export interface BattlePassSave {
  season: number
  xp: number
  premium: boolean
  claimedFree: number[]
  claimedPremium: number[]
}

export interface FriendEntry {
  code: string
  name: string
}

export interface CharacterRecord {
  runs: number
  kills: number
  bestSurvivalSeconds: number
  timePlayed: number
  bossesDefeated: number
}

export interface SaveData {
  version: number
  gold: number
  /** Stable code other players use to add you. */
  friendCode: string
  friends: FriendEntry[]
  /** Skill-tree node id -> purchased rank. */
  metaUpgrades: Record<string, number>
  /** Lifetime profile XP. Level is derived from this, up to 999. */
  accountXp: number
  unlockedCharacters: string[]
  unlockedWeapons: string[]
  /** Passives that have been equipped at least once. */
  unlockedPassives: string[]
  /** Enemy type indexes met on screen during a run. */
  seenEnemies: number[]
  lastCharacter: string
  /** Common weapon chosen per heroine before a run. Missing entries use her base weapon. */
  starterWeapons: Record<string, string>
  /** Per-character record. The menu shows whoever has the most runs. */
  characterStats: Record<string, CharacterRecord>
  /** Lifetime stats, used for unlock conditions. */
  stats: {
    totalKills: number
    totalRuns: number
    bestSurvivalSeconds: number
    bossesDefeated: number
    /** Seconds survived across every run, including ones left early. */
    timePlayed: number
  }
  settings: SaveSettings
  ownedCosmetics: string[]
  equipped: CosmeticLoadout
  battlePass: BattlePassSave
  /** Highest world index reached. 1 is the first night; 2 unlocks the hidden musician. */
  worldsReached: number
  /**
   * While set, the live unlock lists are the full catalog and this object is the real profile.
   * A temporary control until the game is finished.
   */
  devUnlock: DevUnlockBackup | null
}

/** The profile fields replaced by the temporary unlock-all button. */
export interface DevUnlockBackup {
  unlockedCharacters: string[]
  unlockedWeapons: string[]
  unlockedPassives: string[]
  seenEnemies: number[]
  ownedCosmetics: string[]
  worldsReached: number
  battlePass: BattlePassSave
  equipped: CosmeticLoadout
}

export function emptyLoadout(): CosmeticLoadout {
  return { characterSkins: {}, weaponSkins: {}, ornament: null, pet: null, effect: null }
}

const FRIEND_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeFriendCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += FRIEND_ALPHABET[Math.floor(Math.random() * FRIEND_ALPHABET.length)]
  return code
}

export function defaultSettings(): SaveSettings {
  return {
    masterVolume: 0.8,
    musicVolume: 0.7,
    musicEnabled: true,
    sfxVolume: 0.8,
    screenShake: 1,
    damageNumbers: true,
    fullscreen: true,
    playerName: 'Jugador'
  }
}

export function emptyCharacterRecord(): CharacterRecord {
  return { runs: 0, kills: 0, bestSurvivalSeconds: 0, timePlayed: 0, bossesDefeated: 0 }
}

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: 0,
    friendCode: makeFriendCode(),
    friends: [],
    metaUpgrades: {},
    accountXp: 0,
    unlockedCharacters: ['sakura'],
    unlockedWeapons: [],
    unlockedPassives: [],
    seenEnemies: [],
    lastCharacter: 'sakura',
    worldsReached: 1,
    starterWeapons: {},
    characterStats: {},
    stats: { totalKills: 0, totalRuns: 0, bestSurvivalSeconds: 0, bossesDefeated: 0, timePlayed: 0 },
    settings: defaultSettings(),
    ownedCosmetics: ['shikigami'],
    equipped: { ...emptyLoadout(), pet: 'shikigami' },
    battlePass: {
      season: BATTLE_PASS_SEASON,
      xp: 0,
      premium: false,
      claimedFree: [],
      claimedPremium: []
    },
    devUnlock: null
  }
}

function hydrateSettings(raw: Partial<SaveSettings> | undefined, defaults: SaveSettings): SaveSettings {
  const settings = { ...defaults, ...raw }
  if (raw?.fullscreenChosen !== true) settings.fullscreen = true
  return settings
}

function hydrateStarterWeapons(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, weapon] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_]+$/.test(id) || typeof weapon !== 'string' || !/^[a-z0-9_]+$/.test(weapon)) continue
    out[id] = weapon
  }
  return out
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

function hydrateDevUnlock(raw: unknown): DevUnlockBackup | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<DevUnlockBackup>
  if (!Array.isArray(row.unlockedCharacters) || !row.battlePass || !row.equipped) return null
  const bp = row.battlePass
  const equipped = row.equipped
  return {
    unlockedCharacters: stringList(row.unlockedCharacters),
    unlockedWeapons: stringList(row.unlockedWeapons),
    unlockedPassives: stringList(row.unlockedPassives),
    seenEnemies: Array.isArray(row.seenEnemies) ? row.seenEnemies.filter((n): n is number => typeof n === 'number') : [],
    ownedCosmetics: stringList(row.ownedCosmetics),
    worldsReached: row.worldsReached === 2 ? 2 : 1,
    battlePass: {
      season: typeof bp.season === 'number' ? bp.season : BATTLE_PASS_SEASON,
      xp: typeof bp.xp === 'number' ? bp.xp : 0,
      premium: !!bp.premium,
      claimedFree: Array.isArray(bp.claimedFree) ? bp.claimedFree.filter((n): n is number => typeof n === 'number') : [],
      claimedPremium: Array.isArray(bp.claimedPremium) ? bp.claimedPremium.filter((n): n is number => typeof n === 'number') : []
    },
    equipped: {
      characterSkins: { ...equipped.characterSkins },
      weaponSkins: { ...equipped.weaponSkins },
      ornament: equipped.ornament ?? null,
      pet: equipped.pet ?? null,
      effect: equipped.effect ?? null
    }
  }
}

function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Older saves only had global totals. Those counts stay with the last character until new runs split them. */
function hydrateCharacterStats(raw: unknown, lastCharacter: string, stats: SaveData['stats']): Record<string, CharacterRecord> {
  const out: Record<string, CharacterRecord> = {}
  if (raw && typeof raw === 'object') {
    for (const [id, row] of Object.entries(raw as Record<string, Partial<CharacterRecord>>)) {
      if (!/^[a-z0-9_]+$/.test(id)) continue
      out[id] = {
        runs: asCount(row?.runs),
        kills: asCount(row?.kills),
        bestSurvivalSeconds: asCount(row?.bestSurvivalSeconds),
        timePlayed: asCount(row?.timePlayed),
        bossesDefeated: asCount(row?.bossesDefeated)
      }
    }
  }
  const played = Object.values(out).some((row) => row.runs > 0)
  if (!played && stats.totalRuns > 0) {
    out[lastCharacter || 'sakura'] = {
      runs: stats.totalRuns,
      kills: stats.totalKills,
      bestSurvivalSeconds: stats.bestSurvivalSeconds,
      timePlayed: stats.bestSurvivalSeconds,
      bossesDefeated: stats.bossesDefeated
    }
  }
  return out
}

/** Clears progress, unlocks and discoveries. The cooperative name stays. */
export function wipeProfile(save: SaveData): void {
  const name = save.settings.playerName
  const fresh = createDefaultSave()
  fresh.settings.playerName = name.trim().slice(0, 16) || 'Jugador'
  Object.assign(save, fresh)
}

export function noteCharacterRun(save: SaveData, characterId: string, run: { time: number; kills: number; bosses: number }): void {
  if (!save.characterStats) save.characterStats = {}
  const row = save.characterStats[characterId] ?? emptyCharacterRecord()
  row.runs += 1
  row.kills += Math.max(0, Math.floor(run.kills))
  row.timePlayed += Math.max(0, run.time)
  row.bestSurvivalSeconds = Math.max(row.bestSurvivalSeconds, Math.floor(run.time))
  row.bossesDefeated += Math.max(0, Math.floor(run.bosses))
  save.characterStats[characterId] = row
}

/** Gold spent in the old permanent shop, returned once when the skill tree replaces it. */
const LEGACY_META: Record<string, { max: number; base: number }> = {
  might: { max: 5, base: 200 },
  armor: { max: 3, base: 300 },
  maxHp: { max: 5, base: 150 },
  recovery: { max: 5, base: 200 },
  cooldown: { max: 2, base: 800 },
  area: { max: 2, base: 300 },
  speed: { max: 2, base: 200 },
  duration: { max: 2, base: 300 },
  amount: { max: 1, base: 5000 },
  moveSpeed: { max: 2, base: 300 },
  magnet: { max: 2, base: 300 },
  luck: { max: 3, base: 600 },
  growth: { max: 5, base: 900 },
  greed: { max: 5, base: 200 },
  revival: { max: 1, base: 10000 }
}

function legacyMetaRefund(purchased: unknown): number {
  if (!purchased || typeof purchased !== 'object') return 0
  let total = 0
  for (const [id, rank] of Object.entries(purchased as Record<string, unknown>)) {
    const def = LEGACY_META[id]
    const n = typeof rank === 'number' && Number.isFinite(rank) ? Math.max(0, Math.floor(rank)) : 0
    if (!def || n <= 0) continue
    for (let r = 0; r < Math.min(n, def.max); r++) total += Math.round(def.base * (1 + r) * (1 + 0.1 * r))
  }
  return total
}

const EXCLUSIVE_PET = 'shikigami'

function hydrateOwnedCosmetics(raw: unknown): string[] {
  const owned = new Set<string>()
  if (Array.isArray(raw)) {
    for (const id of raw) if (id === EXCLUSIVE_PET) owned.add(EXCLUSIVE_PET)
  }
  owned.add(EXCLUSIVE_PET)
  return [...owned]
}

/** Equipa el familiar la primera vez que entra en la colección. Si ya lo tenías y lo quitaste, se queda quitado. */
function hydratePet(pet: unknown, ownedRaw: unknown): string | null {
  if (pet === EXCLUSIVE_PET) return EXCLUSIVE_PET
  const already = Array.isArray(ownedRaw) && ownedRaw.includes(EXCLUSIVE_PET)
  return already ? null : EXCLUSIVE_PET
}

function sanitizeStringMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_]+$/.test(id) || typeof value !== 'string' || !/^[a-z0-9_]+$/.test(value)) continue
    out[id] = value
  }
  return out
}

function sanitizeRanks(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, rank] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_]+$/.test(id) || typeof rank !== 'number' || !Number.isFinite(rank) || rank <= 0) continue
    out[id] = Math.floor(rank)
  }
  return out
}

/** Merges a raw save (or an older version) onto the current defaults. */
export function hydrateSave(raw: Partial<SaveData> | null | undefined): SaveData {
  const defaults = createDefaultSave()
  if (!raw || typeof raw !== 'object') return defaults
  const equipped = raw.equipped
  const bp = raw.battlePass
  const friendCode = typeof raw.friendCode === 'string' ? raw.friendCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : ''
  const friends = Array.isArray(raw.friends)
    ? raw.friends
        .map((f) => ({
          code: typeof f?.code === 'string' ? f.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '',
          name: typeof f?.name === 'string' ? f.name.slice(0, 16) : ''
        }))
        .filter((f) => f.code.length === 6)
        .slice(0, 24)
    : []
  const season = typeof bp?.season === 'number' ? bp.season : BATTLE_PASS_SEASON
  const stats = { ...defaults.stats, ...raw.stats }
  const playable = new Set(['sakura', 'rin', 'kaede', 'yuki', 'hikari', 'akane'])
  const lastCharacter = typeof raw.lastCharacter === 'string' && playable.has(raw.lastCharacter) ? raw.lastCharacter : defaults.lastCharacter
  const characterStats = hydrateCharacterStats(raw.characterStats, lastCharacter, stats)
  const hadAccount = typeof raw.accountXp === 'number' && Number.isFinite(raw.accountXp)
  if (typeof raw.stats?.timePlayed !== 'number' || !Number.isFinite(raw.stats.timePlayed)) {
    stats.timePlayed = Object.values(characterStats).reduce((sum, row) => sum + row.timePlayed, 0)
  }
  let gold = typeof raw.gold === 'number' && Number.isFinite(raw.gold) ? Math.max(0, Math.floor(raw.gold)) : 0
  let metaUpgrades = sanitizeRanks(raw.metaUpgrades)
  let accountXp = hadAccount ? Math.max(0, Math.floor(raw.accountXp as number)) : 0
  if (!hadAccount) {
    gold += legacyMetaRefund(raw.metaUpgrades)
    metaUpgrades = {}
    accountXp = accountXpForRun(stats.timePlayed, stats.totalKills, stats.bossesDefeated)
  }
  return {
    ...defaults,
    ...raw,
    version: SAVE_VERSION,
    gold,
    accountXp,
    metaUpgrades,
    friendCode: friendCode.length === 6 ? friendCode : defaults.friendCode,
    friends,
    lastCharacter,
    worldsReached: typeof raw.worldsReached === 'number' && raw.worldsReached >= 2 ? 2 : 1,
    starterWeapons: hydrateStarterWeapons(raw.starterWeapons),
    characterStats,
    stats,
    settings: hydrateSettings(raw.settings, defaults.settings),
    unlockedCharacters: Array.isArray(raw.unlockedCharacters)
      ? raw.unlockedCharacters.filter((id): id is string => typeof id === 'string' && playable.has(id))
      : defaults.unlockedCharacters,
    unlockedWeapons: Array.isArray(raw.unlockedWeapons)
      ? raw.unlockedWeapons.filter(
          (id): id is string =>
            typeof id === 'string' && !id.startsWith('guitar') && !id.startsWith('flute') && id !== 'katana_legendary'
        )
      : defaults.unlockedWeapons,
    unlockedPassives: Array.isArray(raw.unlockedPassives) ? raw.unlockedPassives.filter((id): id is string => typeof id === 'string') : [],
    seenEnemies: Array.isArray(raw.seenEnemies)
      ? raw.seenEnemies.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 64)
      : [],
    ownedCosmetics: hydrateOwnedCosmetics(raw.ownedCosmetics),
    equipped: {
      characterSkins: sanitizeStringMap(equipped?.characterSkins),
      weaponSkins: {},
      ornament: null,
      pet: hydratePet(equipped?.pet, raw.ownedCosmetics),
      effect: null
    },
    battlePass:
      season === BATTLE_PASS_SEASON
        ? {
            season,
            xp: typeof bp?.xp === 'number' ? bp.xp : 0,
            premium: !!bp?.premium,
            claimedFree: Array.isArray(bp?.claimedFree) ? bp.claimedFree : [],
            claimedPremium: Array.isArray(bp?.claimedPremium) ? bp.claimedPremium : []
          }
        : { ...defaults.battlePass },
    devUnlock: hydrateDevUnlock(raw.devUnlock)
  }
}
