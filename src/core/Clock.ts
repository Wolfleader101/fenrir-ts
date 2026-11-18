/**
 * Where the engine reads time. `Time` reads only its clock, never `performance.now()` or
 * `Date.now()` directly, so a test can pass a clock it controls.
 *
 * Two readings, because they are different quantities:
 * - `monotonic()` measures intervals: frame deltas and `time.elapsed`. It never jumps when the
 *   system clock is adjusted. The real clock uses `performance.now()`.
 * - `now()` is the wall clock in epoch milliseconds, what `Date.now()` returns, for timestamps
 *   that must survive a reload. The real clock uses `Date.now()`.
 *
 * One clock supplies both, so moving a test clock moves both together.
 */
export interface Clock {
  /** Milliseconds from an arbitrary origin. Never goes backwards. */
  monotonic(): number;
  /** Wall-clock milliseconds since the Unix epoch. */
  now(): number;
}

/** The browser's clock. The default for every `Time`. */
export const realClock: Clock = {
  monotonic: () => performance.now(),
  now: () => Date.now(),
};

/**
 * A clock that moves only when told to. Internal: tests build one, and the test game (#34)
 * drives one with `game.clock.advance(ms)`.
 */
export class ManualClock implements Clock {
  private elapsedMs = 0;
  private readonly startNow: number;

  /** @param now Wall-clock epoch milliseconds that `now()` starts at. Defaults to 0. */
  constructor(now = 0) {
    if (!Number.isFinite(now)) {
      throw new RangeError(`ManualClock start time must be finite epoch milliseconds, got ${now}.`);
    }
    this.startNow = now;
  }

  /** Moves both readings forward by `ms` milliseconds. */
  public advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`clock.advance(ms) needs a finite number of milliseconds of at least 0, got ${ms}.`);
    }
    this.elapsedMs += ms;
  }

  public monotonic(): number {
    return this.elapsedMs;
  }

  public now(): number {
    return this.startNow + this.elapsedMs;
  }
}
