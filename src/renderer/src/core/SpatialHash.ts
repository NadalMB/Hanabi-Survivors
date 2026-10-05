/**
 * Uniform grid hashed into a fixed bucket table, rebuilt every tick with a
 * counting sort (no allocations). Queries return candidate indices in `result`;
 * callers must still do the exact distance test.
 *
 * `result` is shared: never run a query while iterating the results of another.
 */
export class SpatialHash {
  readonly result: Int32Array
  private readonly cellStart: Int32Array
  private readonly cursor: Int32Array
  private readonly bucketStamp: Int32Array
  private readonly entries: Int32Array
  private readonly entryBucket: Int32Array
  private readonly mask: number
  private stamp = 0

  constructor(
    private readonly cellSize: number,
    tableBits: number,
    capacity: number
  ) {
    const size = 1 << tableBits
    this.mask = size - 1
    this.cellStart = new Int32Array(size + 1)
    this.cursor = new Int32Array(size)
    this.bucketStamp = new Int32Array(size)
    this.entries = new Int32Array(capacity)
    this.entryBucket = new Int32Array(capacity)
    this.result = new Int32Array(capacity)
  }

  private bucket(cx: number, cy: number): number {
    return (Math.imul(cx, 0x8da6b343) ^ Math.imul(cy, 0xd8163841)) & this.mask
  }

  build(xs: Float32Array, ys: Float32Array, alive: Uint8Array, count: number): void {
    const { cursor, cellStart, entries, entryBucket, cellSize, mask } = this
    cursor.fill(0)
    for (let i = 0; i < count; i++) {
      if (!alive[i]) {
        entryBucket[i] = -1
        continue
      }
      const b = this.bucket(Math.floor(xs[i] / cellSize), Math.floor(ys[i] / cellSize))
      entryBucket[i] = b
      cursor[b]++
    }
    cellStart[0] = 0
    for (let b = 0; b <= mask; b++) {
      cellStart[b + 1] = cellStart[b] + cursor[b]
      cursor[b] = cellStart[b]
    }
    for (let i = 0; i < count; i++) {
      const b = entryBucket[i]
      if (b >= 0) entries[cursor[b]++] = i
    }
  }

  query(x: number, y: number, radius: number): number {
    const cs = this.cellSize
    const x0 = Math.floor((x - radius) / cs)
    const x1 = Math.floor((x + radius) / cs)
    const y0 = Math.floor((y - radius) / cs)
    const y1 = Math.floor((y + radius) / cs)
    const stamp = ++this.stamp
    const { result, entries, cellStart, bucketStamp } = this
    const max = result.length
    let n = 0
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.bucket(cx, cy)
        // Two cells can hash to the same bucket; visiting it twice would duplicate hits.
        if (bucketStamp[b] === stamp) continue
        bucketStamp[b] = stamp
        for (let k = cellStart[b], end = cellStart[b + 1]; k < end && n < max; k++) result[n++] = entries[k]
      }
    }
    return n
  }
}
