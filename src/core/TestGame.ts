import { ManualClock } from "./Clock";
import { GameImpl, createServices, installPlugins } from "./Game";
import type { GameBase, Plugin } from "./Game";
import type { ILogger } from "./ILogger";
import type { TestInput } from "./Input/Input";

/** What `createTestGame` takes. `seed` is required; there is no canvas. */
export interface TestGameOptions {
  /** Seeds `game.random` and `ctx.random`: a safe integer. Required, so every run draws the same numbers. */
  seed: number;
  /** Wall-clock epoch milliseconds that `time.now()` starts at. Defaults to 0. */
  now?: number;
  /**
   * Installed in order, as in `createGame`. A test game has no canvas, so a plugin that reads
   * `game.canvas`, such as `pixi2d`, throws when it installs.
   */
  plugins?: readonly Plugin[];
  /** Defaults to a ConsoleLogger, as in `createGame`. */
  logger?: ILogger;
  /** The frame-delta clamp, as in `createGame`: `step(dt)` throws for a `dt` above it. Defaults to 0.25. */
  maxFrameDelta?: number;
  /** Seconds per `Tick`, as in `createGame`: set on `time.fixedDelta` before the first frame. Defaults to 1/60. */
  fixedDelta?: number;
  /** The most `Tick` stages one `step` frame runs, as in `createGame`; the rest are dropped. Defaults to 8. */
  maxTicksPerFrame?: number;
}

/** The test game's clock. It moves only when told to. */
export interface TestClock {
  /** Moves `time.now()` forward by `ms` milliseconds without running a frame. */
  advance(ms: number): void;
}

/**
 * A game with no renderer, no canvas and no frame loop, built by `createTestGame`. Frames run
 * only when `step(dt)` is called, on a clock that moves only with `step` and `clock.advance`.
 *
 * It has `start()` where a `Game` has `run()`, because `run()` hands frames to
 * `requestAnimationFrame` and a test game has none. It has no `pause` or `resume`: it is never
 * running between steps, so there is nothing to pause.
 */
export interface TestGame extends GameBase {
  readonly clock: TestClock;
  /**
   * Runs PreInit, Init and PostInit, as `run()` does on a `Game`, with the same rollback when a
   * startup system throws. Schedules no frame: call `step(dt)`.
   */
  start(): Promise<void>;
  /**
   * The same `Input` that systems read as `ctx.input`, plus `press`, `release`, `pointerDown`,
   * `pointerMove`, `pointerUp`, `pointerCancel`, `focus` and `blur`, which stand in for the player
   * and take effect on the next `step`.
   */
  readonly input: TestInput;
}

class TestGameImpl extends GameImpl implements TestGame {
  public readonly clock: TestClock;
  declare public readonly input: TestInput;

  constructor(options: TestGameOptions, clock: ManualClock) {
    super(options, createServices(options.seed), {
      clock,
      loop: "step",
      // Each stepped frame moves the wall clock too, so time.now() reads as it would in the browser.
      beforeStep: (dt) => clock.advance(dt * 1000),
    });
    this.clock = clock;
  }

  public start(): Promise<void> {
    return this.engine.run();
  }
}

/**
 * Builds a game for tests and tools: the same scheduler, services, states, events and plugins
 * as `createGame`, with no canvas and no `requestAnimationFrame`. Nothing reads
 * `performance.now()` or `Date.now()`: time moves only with `step` and `clock.advance`.
 *
 * ```ts
 * const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
 * game.addSystem(Schedule.Update, movePlayer);
 * await game.start();
 * game.step(1 / 60, 60); // one second
 * await game.stop();
 * ```
 */
export async function createTestGame(options: TestGameOptions): Promise<TestGame> {
  if (!options || !Number.isSafeInteger(options.seed)) {
    throw new TypeError(`createTestGame needs { seed }: a safe integer, so random draws repeat. Got ${options?.seed}.`);
  }
  const game = new TestGameImpl(options, new ManualClock(options.now ?? 0));
  await installPlugins(game, options.plugins, "createTestGame");
  return game;
}
