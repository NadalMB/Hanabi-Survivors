/** Profile level. 1 is the start; 999 is the cap. Each step asks for more XP than the last. */
export const ACCOUNT_LEVEL_CAP = 999

/**
 * XP needed to leave `level` (1-based). The first step already takes a long run,
 * and each one after that asks for more.
 */
export function xpRequiredForAccountLevel(level: number): number {
  const current = Math.max(1, Math.min(ACCOUNT_LEVEL_CAP - 1, level))
  return Math.floor(7 * Math.pow(current, 1.26) + 2800)
}

export function accountLevel(xp: number): number {
  let level = 1
  let left = Math.max(0, Math.floor(xp))
  while (level < ACCOUNT_LEVEL_CAP) {
    const cost = xpRequiredForAccountLevel(level)
    if (left < cost) break
    left -= cost
    level++
  }
  return level
}

/** Progress inside the current level. At 999 the bar stays full. */
export function accountXpProgress(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let left = Math.max(0, Math.floor(xp))
  while (level < ACCOUNT_LEVEL_CAP) {
    const cost = xpRequiredForAccountLevel(level)
    if (left < cost) return { level, into: left, need: cost }
    left -= cost
    level++
  }
  const need = xpRequiredForAccountLevel(ACCOUNT_LEVEL_CAP - 1)
  return { level: ACCOUNT_LEVEL_CAP, into: need, need }
}

/** Profile XP for a stretch of a run. Time is seconds. */
export function accountXpForRun(time: number, kills: number, bosses: number): number {
  return Math.floor(Math.max(0, time) * 1.2 + Math.max(0, kills) * 0.5 + Math.max(0, bosses) * 25)
}
