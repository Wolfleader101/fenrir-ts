import { AssetStore } from "./Assets/AssetStore";
import { realClock } from "./Clock";
import { ConsoleLogger } from "./ConsoleLogger";
import { Engine } from "./Engine";
import type { EngineOptions } from "./Engine";
import { EventBus, listenAcrossRuns, type EventHandler } from "./EventBus";
import type { EventType } from "./EventQueue";
import { Resources } from "./Resource";
import type { ILogger } from "./ILogger";
import { Random, seedFromClock } from "./Random";
import { SceneManager } from "./SceneManager";
import { Scheduler } from "./Scheduler";
import { GameStates } from "./State";
import { InputImpl } from "./Input/Input";
import type { StateType, States } from "./State";
import type { AsyncStage, ScheduleStage, SyncStage, SystemOptions } from "./Scheduler";
import type { AsyncSystemFn, GameServices, SyncSystemFn } from "./SystemCtx";

/**
 * Something that attaches to a game: a renderer, and later physics, audio or UI.
 *
 * `install` runs once, inside `createGame`, before the game runs. It registers systems and
 * may read `game.canvas`, `game.logger`, `game.assets` and `game.events`. It should not acquire
 * resources such as GPU contexts or listeners: do that in an `Init` system, and release them
 * with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.
 *
 * `createTestGame` installs plugins too, but a test game has no canvas: reading `game.canvas`
 * there throws, so a renderer plugin such as `pixi2d` fails to install and says so. A plugin
 * that only adds systems, resources or listeners installs in both.
 */
export interface Plugin {
  /** Namespaced, for example `fenrir.pixi2d` or `myGame.audio`. One plugin per name per game. */
  readonly name: string;
  install(game: Game): void | Promise<void>;
}

/** What `createGame` takes. Only `canvas` is required. */
export interface GameOptions {
  /** The canvas the game draws to. Renderer plugins read it from `game.canvas`. */
  canvas: HTMLCanvasElement;
  /** Installed in order. An async `install` is awaited before the next plugin installs. */
  plugins?: readonly Plugin[];
  /** Defaults to a ConsoleLogger. */
  logger?: ILogger;
  /**
   * Seeds `game.random` and `ctx.random`: a safe integer. Without one, the seed comes from the
   * clock, and `game.random.seed` reports it. Stopping and running the game again continues
   * the sequence; it does not restart it.
   */
  seed?: number;
  /**
   * The longest frame the game simulates, in seconds: `time.delta` is clamped to it, so a frame
   * after a stall (a background tab, a debugger, a slow device) moves the game this much at most,
   * and `step(dt)` throws above it. Defaults to 0.25. A game whose motion must never jump far
   * sets a smaller cap, such as `1 / 20`. A positive finite number; anything else throws.
   */
  maxFrameDelta?: number;
}

/**
 * What a `Game` and a `TestGame` share: registration, services, `stop` and `step`. Systems,
 * hooks and listeners written against it run unchanged in both.
 */
export interface GameBase extends GameServices {
  readonly logger: ILogger;
  readonly assets: AssetStore;
  readonly events: EventBus;

  addSystem(stage: SyncStage, system: SyncSystemFn, options?: SystemOptions): this;
  addSystem(stage: AsyncStage, system: AsyncSystemFn, options?: SystemOptions): this;
  /** Removes every system called `name`. While running, it stops running from the next frame. */
  removeSystem(name: string): this;
  /** Swaps the function of every system called `name`, keeping its position and options. */
  replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;

  /** Runs Exit systems, then cleanups in reverse order. */
  stop(): Promise<void>;

  /**
   * Whether the game is running: startup finished and `stop()` has not been called since,
   * paused included. False before `run()` (or `start()` on a test game), during startup, and
   * from the moment `stop()` is called. `run()` resolves without throwing when the game is
   * stopped during startup, so check this after `await game.run()` to know gameplay started.
   */
  isRunning(): boolean;

  /**
   * Runs `frames` whole frames now, each `dt` seconds of game time (default 1/60), through the
   * same frame body as the browser loop: PreUpdate, the Tick stages the accumulator holds (at
   * most 8 a frame, the rest dropped, as after a long browser frame), Update, PostUpdate, then
   * the event buffers advance. Fixed ticks accumulate from `dt` exactly.
   *
   * `dt` is at most `maxFrameDelta` (0.25 s by default), the frame-delta clamp; a longer `dt` throws rather than silently
   * simulating less: write `step(1 / 60, 60)` for a second. On a `Game`, `step` runs only while
   * paused (`pause()` first) and advances by `dt` whatever the real time; the game's systems
   * all run, so a renderer draws each stepped frame. On a `TestGame`, it runs after `start()`.
   * A system that throws stops the game and the error propagates from `step`.
   */
  step(dt?: number, frames?: number): void;

  /**
   * Runs `system` each time `state` changes to `value`, after the exit hooks of the old value.
   * Each run starts every state at its initial value and runs its enter hooks before the first PreInit system.
   */
  onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
  /** Runs `system` each time `state` changes away from `value`, before the enter hooks of the new value. */
  onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;

  /**
   * Calls `handler(payload, ctx)` synchronously at every `send` of `event` while the game runs,
   * in registration order. Setup, like `addSystem`: it stays across `stop()` and `run()` until
   * the returned function removes it. For a listener that belongs to one run, call
   * `ctx.events.on` from a system.
   */
  on<T>(event: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void;
}

/** A running game. Built by `createGame`. */
export interface Game extends GameBase {
  readonly canvas: HTMLCanvasElement;

  /** Runs PreInit, Init and PostInit, then resolves when the first frame is scheduled. */
  run(): Promise<void>;
  /** Stops scheduling frames. `step(dt)` runs frames while paused. */
  pause(): void;
  resume(): void;
}

/** Internal. `createGame` and `createTestGame` both build one, so the two cannot drift. */
export class GameImpl implements Game {
  declare public readonly resources: Resources;
  public readonly logger: ILogger;
  declare public readonly assets: AssetStore;
  public readonly events: EventBus;
  declare public readonly random: Random;
  declare public readonly states: States;
  declare public readonly input: GameServices["input"];
  protected readonly engine: Engine;
  private readonly target?: HTMLCanvasElement;

  constructor(
    options: Omit<GameOptions, "canvas" | "seed"> & { canvas?: HTMLCanvasElement },
    services: GameServices,
    engineOptions: Pick<EngineOptions, "clock" | "loop" | "beforeStep">,
  ) {
    this.target = options.canvas;
    this.logger = options.logger ?? new ConsoleLogger();
    this.events = new EventBus();
    Object.assign(this, services);
    this.engine = new Engine({
      scheduler: new Scheduler(),
      sceneManager: new SceneManager(this.logger),
      events: this.events,
      logger: this.logger,
      services,
      maxFrameDelta: options.maxFrameDelta,
      ...engineOptions,
    });
  }

  public get canvas(): HTMLCanvasElement {
    if (!this.target) {
      throw new Error("A test game has no canvas, so a plugin that draws, such as pixi2d, cannot install in createTestGame. Leave it out of the test game's plugins: the systems that do not draw run without it.");
    }
    return this.target;
  }

  public addSystem(stage: SyncStage, system: SyncSystemFn, options?: SystemOptions): this;
  public addSystem(stage: AsyncStage, system: AsyncSystemFn, options?: SystemOptions): this;
  public addSystem(stage: ScheduleStage, system: SyncSystemFn | AsyncSystemFn, options?: SystemOptions): this {
    this.engine.addSystem(stage as SyncStage, system as SyncSystemFn, options);
    return this;
  }

  public removeSystem(name: string): this {
    this.engine.removeSystem(name);
    return this;
  }

  public replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this {
    this.engine.replaceSystem(name, system);
    return this;
  }

  public onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this {
    gameStates(this).hook("enter", state, value, system);
    return this;
  }

  public onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this {
    gameStates(this).hook("exit", state, value, system);
    return this;
  }

  public on<T>(event: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void {
    return listenAcrossRuns(this.events, event, handler);
  }

  public run(): Promise<void> {
    return this.engine.run();
  }

  public stop(): Promise<void> {
    return this.engine.stop();
  }

  public step(dt?: number, frames?: number): void {
    this.engine.step(dt, frames);
  }

  public isRunning(): boolean {
    return this.engine.isActive();
  }

  public pause(): void {
    this.engine.pause();
  }

  public resume(): void {
    this.engine.resume();
  }
}

/** The game's own `States`, which `createGame` always builds as a GameStates. */
const gameStates = (game: Game): GameStates => game.states as GameStates;

/**
 * Builds a game: scheduler, scene manager, event bus, logger and asset store, then installs
 * each plugin in order, awaiting async installs. Rejects with the plugin's error if an install
 * throws; nothing has run yet, so there is nothing to roll back.
 *
 * ```ts
 * const game = await createGame({ canvas, plugins: [pixi2d()] });
 * game.addSystem(Schedule.Update, movePlayer);
 * await game.run();
 * ```
 */
export async function createGame(options: GameOptions): Promise<Game> {
  if (!options || !(options.canvas instanceof HTMLCanvasElement)) {
    throw new TypeError("createGame needs { canvas }: the HTMLCanvasElement the game draws to.");
  }

  const clock = realClock;
  const services = createServices(options.seed ?? seedFromClock(clock));
  // Input listens on the canvas from each run's start until it stops.
  (services.input as InputImpl).canvas = options.canvas;

  const game = new GameImpl(options, services, { clock });
  await installPlugins(game, options.plugins, "createGame");
  return game;
}

/** Internal. The services of a game or a test game, built in one place so the two match. */
export function createServices(seed: number): GameServices {
  const resources = new Resources();
  return {
    resources,

    states: new GameStates(),

    random: new Random(seed),

    input: new InputImpl(resources),

    assets: new AssetStore(),
  };
}

/** Internal. Installs `plugins` in order, awaiting async installs. */
export async function installPlugins(game: GameImpl, plugins: readonly Plugin[] = [], from: string): Promise<void> {
  const installed = new Set<string>();
  for (const plugin of plugins) {
    if (installed.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is listed twice in ${from}'s plugins. Remove one.`);
    }
    installed.add(plugin.name);
    try {
      await plugin.install(game);
    } catch (error) {
      game.logger.error(`Plugin "${plugin.name}" failed to install`, { error });
      throw error;
    }
  }
}
