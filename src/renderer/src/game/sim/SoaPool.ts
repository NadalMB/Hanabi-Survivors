type Column = Float32Array | Int32Array | Uint32Array | Uint8Array

/**
 * Structure-of-arrays pool with dense packing: removing a slot moves the last
 * element into it, so systems always iterate the contiguous range [0, count).
 * Removal is deferred (flag `alive = 0`, then `compact()` at the end of a tick)
 * so indices stay valid while systems run.
 */
export abstract class SoaPool {
  count = 0
  private readonly columns: Column[] = []

  constructor(readonly capacity: number) {}

  protected f32(): Float32Array {
    return this.column(new Float32Array(this.capacity))
  }

  protected u8(): Uint8Array {
    return this.column(new Uint8Array(this.capacity))
  }

  protected u32(): Uint32Array {
    return this.column(new Uint32Array(this.capacity))
  }

  private column<T extends Column>(c: T): T {
    this.columns.push(c)
    return c
  }

  protected allocate(): number {
    return this.count < this.capacity ? this.count++ : -1
  }

  protected moveSlot(from: number, to: number): void {
    for (const c of this.columns) c[to] = c[from]
  }

  protected compactBy(alive: Uint8Array): void {
    let i = 0
    while (i < this.count) {
      if (alive[i]) {
        i++
        continue
      }
      const last = --this.count
      if (i !== last) this.moveSlot(last, i)
    }
  }

  clear(): void {
    this.count = 0
  }
}
