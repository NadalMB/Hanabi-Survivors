/** Mulberry32: tiny, fast and seedable, so the host and replays produce identical runs. */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]
  }

  /** Returns the index of a weighted random pick, or -1 if all weights are zero. */
  weightedIndex<T>(items: readonly T[], weightOf: (item: T) => number): number {
    let total = 0
    for (const item of items) total += weightOf(item)
    if (total <= 0) return -1
    let roll = this.next() * total
    for (let i = 0; i < items.length; i++) {
      roll -= weightOf(items[i])
      if (roll <= 0) return i
    }
    return items.length - 1
  }
}
