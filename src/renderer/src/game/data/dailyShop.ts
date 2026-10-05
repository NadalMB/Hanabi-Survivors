import { Rng } from '@/core/Rng'
import { COSMETICS, shopPool, type CosmeticDef, type CosmeticKind } from './cosmetics'

export interface DailyOffer {
  id: string
  price: number
  featured: boolean
}

const SLOTS: CosmeticKind[] = [
  'character_skin',
  'character_skin',
  'weapon_skin',
  'weapon_skin',
  'ornament',
  'pet',
  'effect',
  'character_skin'
]

export function shopDayKey(now = Date.now()): string {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function msUntilShopReset(now = Date.now()): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now
}

function hashDay(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function take(rng: Rng, pool: CosmeticDef[], used: Set<string>): CosmeticDef | undefined {
  const open = pool.filter((c) => !used.has(c.id))
  if (!open.length) return undefined
  const pick = rng.pick(open)
  used.add(pick.id)
  return pick
}

/** Deterministic 8-item rotation for the local calendar day. Same for every player. */
export function dailyOffers(dayKey = shopDayKey()): DailyOffer[] {
  const rng = new Rng(hashDay(dayKey))
  const pool = shopPool()
  const used = new Set<string>()
  const picked: CosmeticDef[] = []

  for (const kind of SLOTS) {
    const item = take(rng, pool.filter((c) => c.kind === kind), used) ?? take(rng, pool, used)
    if (item) picked.push(item)
  }

  const featuredAt = rng.int(picked.length)
  return picked.map((c, i) => ({
    id: c.id,
    price: i === featuredAt ? Math.max(200, Math.round(c.price * 0.75)) : c.price,
    featured: i === featuredAt
  }))
}

export function offerDef(offer: DailyOffer): CosmeticDef {
  return COSMETICS[offer.id]
}
