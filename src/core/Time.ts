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
   * Seconds of frame time not yet consumed by fixed ticks, below `fixedDelta` after each frame.
   * `accumulator / fixedDelta` is the interpolation factor between the last two ticks.
   */
  public accumulator = 0;

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

  /** Wall-clock milliseconds since the Unix epoch. Use instead of `Date.now()`. */
  public now(): number {
    return this.clock.now();
  }

  public update(maxDelta = Infinity) {
    const currentTime = this.clock.monotonic();
    this.frameDelta = Math.min(maxDelta, (currentTime - this.prevTime) * 0.001); // ms to seconds
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
    this.startTime = this.clock.monotonic();
    this.prevTime = this.startTime;
    this.paused = false;
    this.pauseStartTime = 0;
    this.totalPausedTime = 0;
  }
}
