import type { Clock } from "./Clock";
import { realClock } from "./Clock";

/**
 * Frame and game time: `ctx.time`. Reads only the clock it is given, which defaults to the
 * real one, so tests can control every reading.
 */
export class Time {
  /** Seconds per fixed tick. Settable; defaults to 1/60. */
  public fixedDelta = 1.0 / 60.0;
  /**
   * Seconds of frame time not yet consumed by fixed ticks, below `fixedDelta` after each frame's
   * ticks. `tickFraction` is it as a fraction of a tick.
   */
  public accumulator = 0;

  private tickCount = 0;

  private readonly clock: Clock;
  private frameDelta = 0;
  private startTime = 0;
  private prevTime = 0;
  private paused = false;
  private pauseStartTime = 0;
  private totalPausedTime = 0;

  constructor(clock: Clock = realClock) {
    this.clock = clock;
    this.startTime = clock.monotonic();
    this.prevTime = this.startTime;
  }

  /** Seconds since the last frame, clamped to the engine's maximum frame delta. */
  public get delta(): number {
    return this.frameDelta;
  }

  /** Seconds of game time since the run started, excluding pauses. */
  public get elapsed(): number {
    const currentTime = this.paused ? this.pauseStartTime : this.clock.monotonic();
    return (currentTime - this.startTime - this.totalPausedTime) * 0.001;
  }

  /**
   * `Tick` stages begun since the run started. Inside a `Tick` system it numbers the tick
   * running, from 1; in the other stages it is the number of the latest tick.
   */
  public get ticks(): number {
    return this.tickCount;
  }

  /**
   * How far the frame has run past the latest tick, as a fraction of a tick: `accumulator /
   * fixedDelta`, from 0 to 1. Read it in `Update` or `PostUpdate`, after the frame's ticks, to
   * draw state that `Tick` changes between its last two values:
   * `previous + (current - previous) * time.tickFraction`. `tickValue()` keeps the previous
   * value for you. In `PreUpdate` the frame's ticks have not run yet, and in `Tick` it means nothing.
   */
  public get tickFraction(): number {
    return Math.min(1, this.accumulator / this.fixedDelta);
  }

  /** Wall-clock milliseconds since the Unix epoch. Use instead of `Date.now()`. */
  public now(): number {
    return this.clock.now();
  }

  /**
   * Starts a frame: sets `delta`, clamped to `maxDelta`, and adds it to the accumulator.
   * Without `frameSeconds`, the frame lasted since the last update, read from the clock. With
   * it, the frame lasted exactly that long, which is how `game.step(dt)` runs frames: the delta
   * is `dt` itself, not a clock difference, so fixed ticks add up without rounding. A frame
   * stepped while paused counts towards `elapsed`.
   */
  public update(maxDelta = Infinity, frameSeconds?: number) {
    const currentTime = this.clock.monotonic();
    if (frameSeconds === undefined) {
      this.frameDelta = Math.min(maxDelta, (currentTime - this.prevTime) * 0.001); // ms to seconds
    } else {
      this.frameDelta = Math.min(maxDelta, frameSeconds);
      if (this.paused) this.totalPausedTime -= this.frameDelta * 1000;
    }
    this.prevTime = currentTime;

    this.accumulator += this.frameDelta;
  }

  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pauseStartTime = this.clock.monotonic();
  }

  public resume(): void {
    if (!this.paused) return;
    this.paused = false;

    const resumedAt = this.clock.monotonic();
    this.totalPausedTime += resumedAt - this.pauseStartTime;
    // Restart frame timing so the pause does not show up as one long delta.
    this.prevTime = resumedAt;
  }

  public reset(): void {
    this.frameDelta = 0;
    this.accumulator = 0;
    this.tickCount = 0;
    this.startTime = this.clock.monotonic();
    this.prevTime = this.startTime;
    this.paused = false;
    this.pauseStartTime = 0;
    this.totalPausedTime = 0;
  }
}
