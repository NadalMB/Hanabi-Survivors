/**
 * Network protocol between host (authoritative simulation) and clients.
 * Clients only send inputs and choices; the host simulates and streams state.
 * Control messages are JSON strings; world snapshots are binary (see net/snapshot.ts).
 */

import type { CosmeticLoadout } from './save'

export type PlayerId = number

export interface LobbyPlayer {
  id: PlayerId
  name: string
  characterId: string
  /** One of that heroine's two common weapons. Omitted means her base weapon. */
  weaponId?: string
  ready: boolean
  host: boolean
  cosmetics?: CosmeticLoadout
}

export type LootRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface UpgradeChoice {
  kind: 'weapon' | 'passive' | 'evolution' | 'gold' | 'heal' | 'prestige'
  id: string
  level: number
  rarity?: LootRarity
  /** Prestige replaces `id` with this weapon and keeps the current level. */
  into?: string
}

/** Another player's chest, shown beside yours. `pick` is null until they choose, or -1 if they skip. */
export interface ChestPeerView {
  playerId: PlayerId
  name: string
  choices: UpgradeChoice[]
  pick: number | null
  status: 'waiting' | 'picking' | 'taken' | 'skipped'
}

/** Discrete things that happened during a tick; drive VFX, SFX and UI on every peer. */
export type GameEvent =
  | { e: 'damage'; x: number; y: number; amount: number; crit: boolean }
  | { e: 'kill'; x: number; y: number; enemyType: number; elite: boolean }
  | { e: 'player-hit'; playerId: PlayerId; amount: number }
  | { e: 'player-down'; playerId: PlayerId }
  | { e: 'revive'; playerId: PlayerId }
  | { e: 'slash'; x: number; y: number; dir: number; rx: number; ry: number; evolved: boolean; playerId: PlayerId; angle?: number; lead?: boolean }
  | { e: 'strike'; x: number; y: number; radius: number; evolved: boolean; playerId: PlayerId }
  | { e: 'explosion'; x: number; y: number; radius: number; playerId: PlayerId }
  | { e: 'pickup'; kind: number; playerId: PlayerId; x: number; y: number }
  | { e: 'level-up'; level: number }
  | { e: 'chest'; playerId: PlayerId; lines: string[] }
  | { e: 'discover'; playerId: PlayerId; weaponId: string }
  | { e: 'evolution'; playerId: PlayerId; weaponId: string }
  | { e: 'boss'; enemyType: number; mini?: boolean }
  | { e: 'endless' }
  | { e: 'portal' }
  | { e: 'world'; world: number }
  | { e: 'telegraph'; x: number; y: number; radius: number; tint: number; life?: number; x2?: number; y2?: number }

export interface PlayerResult {
  id: PlayerId
  kills: number
  damage: number
}

export interface GameOverInfo {
  victory: boolean
  time: number
  kills: number
  level: number
  gold: number
  /** Bosses defeated during the run. Older hosts omit it. */
  bosses?: number
  players: PlayerResult[]
}

// ---------- Client -> Host ----------

export type ClientMessage =
  | { t: 'hello'; protocol: number; name: string; characterId: string; weaponId?: string; metaUpgrades: Record<string, number>; cosmetics?: CosmeticLoadout }
  | { t: 'lobby-update'; characterId: string; weaponId?: string; ready: boolean }
  | { t: 'input'; seq: number; mx: number; my: number }
  | { t: 'pick-upgrade'; choiceIndex: number }
  | { t: 'set-pause'; paused: boolean }
  | { t: 'request-restart' }

// ---------- Host -> Client ----------

export type HostMessage =
  | { t: 'welcome'; playerId: PlayerId; lobby: LobbyPlayer[] }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; lobby: LobbyPlayer[] }
  | { t: 'start'; seed: number; players: LobbyPlayer[] }
  | { t: 'events'; list: GameEvent[] }
  | { t: 'choices'; choices: UpgradeChoice[] | null; level: number; mode?: 'level' | 'chest'; peers?: ChestPeerView[] }
  | { t: 'game-over'; info: GameOverInfo }
  | { t: 'closed'; reason: string }
  | { t: 'match-paused'; paused: boolean; name: string }
  | { t: 'restart'; seed: number }
