import type { Clock } from "./Clock";

const UINT32_RANGE = 0x1_0000_0000;

/**
 * A seeded random source: `ctx.random` and `game.random`. The same seed gives the same
 * sequence, so a game that draws only from here replays exactly in a test.
 *
 * The generator is mulberry32 (Tommy Ettinger, 2017): 32 bits of state, period 2^32,
 * good enough statistically for gameplay. Not for cryptography.
 */
export class Random {
  /** The 32-bit seed this source started from. Log it to replay a run. */
  public readonly seed: number;
  private state: number;

  /** @param seed A safe integer. It is reduced to 32 bits, so `seed` and `seed + 2 ** 32` match. */
  constructor(seed: number) {
    if (!Number.isSafeInteger(seed)) {
      throw new TypeError(`Random seed must be a safe integer, got ${seed}. Pass, for example, seed: 1.`);
    }
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** A float in [0, 1). */
  public next(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  /**
   * An integer from `min` to `max`, both included. Unbiased: draws are rejected rather than
   * folded with `%`. `max - min` may be at most 2^32 - 1.
   */
  public int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new TypeError(`random.int(min, max) needs safe integers, got (${min}, ${max}).`);
    }
    if (min > max) {
      throw new RangeError(`random.int(min, max) needs min <= max, got (${min}, ${max}). Swap them.`);
    }
    const span = max - min + 1;
    if (span > UINT32_RANGE) {
      throw new RangeError(`random.int(min, max) covers at most 2^32 values, got (${min}, ${max}). Narrow the range.`);
    }
    // The largest multiple of span that fits in 32 bits; draws at or above it would bias low values.
    const limit = UINT32_RANGE - (UINT32_RANGE % span);
    let draw = this.nextUint32();
    while (draw >= limit) draw = this.nextUint32();
    return min + (draw % span);
  }

  /** One item of `items`, each equally likely. Throws on an empty list. */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("random.pick(items) needs at least one item, got an empty list.");
    }
    return items[this.int(0, items.length - 1)]!;
  }

  private nextUint32(): number {
    // mulberry32
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
}

/** A seed for a game created without one: the clock's wall time, reduced to 32 bits. */
export function seedFromClock(clock: Clock): number {
  return Math.floor(clock.now()) % UINT32_RANGE;
}
