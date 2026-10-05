/** Logical viewport in world units; the camera zooms so at least this area is visible. */
export const VIEW_WIDTH = 1280
export const VIEW_HEIGHT = 720

export const SPAWN_RADIUS = 780
export const DESPAWN_RADIUS = 1250
export const CELL_SIZE = 64

export const PLAYER_RADIUS = 14
export const PLAYER_BASE_SPEED = 150
export const PLAYER_IFRAMES = 0.45
export const BASE_MAGNET_RADIUS = 70
export const MAX_WEAPON_SLOTS = 6
export const MAX_PASSIVE_SLOTS = 6

export const RUN_DURATION_SECONDS = 20 * 60
/** World units in one metre, for the off-screen distance labels. */
export const UNITS_PER_METER = 48
export const GEM_SOFT_CAP = 400

export function xpForLevel(level: number): number {
  if (level < 20) return 5 + (level - 1) * 10
  if (level < 40) return 195 + (level - 20) * 13
  return 455 + (level - 40) * 16
}
