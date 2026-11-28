/** What `TickValue` reads from `ctx.time`: the tick count and the fraction past the latest tick. */
export type TickTime = { readonly ticks: number; readonly tickFraction: number };

/**
 * A number that `Tick` changes and the frame draws between ticks. Made by `tickValue(initial)`.
 *
 * Write it with `set` in `Tick`, and read `blend(ctx.time)` in `Update` or `PostUpdate`: the value
 * between the last two ticks, so it moves every frame even when frames and ticks do not line up.
 */
export interface TickValue {
  /** The value the latest `set` or `snap` gave it: the simulation's value. */
  readonly current: number;
  /**
   * Sets the value from a `Tick` system. The first `set` in each tick keeps the value it replaces
   * as the one to blend from, so a frame that runs several ticks blends from the second-to-last.
   */
  set(time: TickTime, value: number): void;
  /** Jumps to `value` with no blend from the old one: for a start, a reset or a teleport, from any stage. */
  snap(value: number): void;
  /**
   * The value to draw now: `previous + (current - previous) * time.tickFraction` when the latest
   * tick set it, where `previous` is its value before that tick. `current` when the latest tick
   * left it alone, so a value that stops changing stops moving.
   */
  blend(time: TickTime): number;
}

class TickNumber implements TickValue {
  public current: number;
  private previous: number;
  /** The tick of the latest `set`, or -1 after a `snap`. */
  private setAt = -1;

  constructor(initial: number) {
    this.current = this.previous = initial;
  }

  public set(time: TickTime, value: number): void {
    if (time.ticks !== this.setAt) {
      this.previous = this.current;
      this.setAt = time.ticks;
    }
    this.current = value;
  }

  public snap(value: number): void {
    this.current = this.previous = value;
    this.setAt = -1;
  }

  public blend(time: TickTime): number {
    if (time.ticks !== this.setAt) return this.current;
    return this.previous + (this.current - this.previous) * time.tickFraction;
  }
}

/**
 * Makes a `TickValue`: a number set in `Tick` and drawn between ticks. Use one for each number
 * the frame draws from fixed-step state, such as a gauge's level, a rope's sag or a camera offset.
 *
 * @example
 * const level = tickValue(0);
 * let gaugeWidth = 0;
 * game.addSystem(Schedule.Tick, function fill({ time }) {
 *   level.set(time, Math.min(1, level.current + 0.5 * time.fixedDelta));
 * });
 * game.addSystem(Schedule.Update, function drawGauge({ time }) {
 *   gaugeWidth = 200 * level.blend(time);
 * });
 */
/* @__NO_SIDE_EFFECTS__ */
export function tickValue(initial = 0): TickValue {
  return new TickNumber(initial);
}
