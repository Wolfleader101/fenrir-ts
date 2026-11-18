import { AssetStore } from "./Assets/AssetStore";
import { realClock } from "./Clock";
import type { Clock } from "./Clock";
import { ConsoleLogger } from "./ConsoleLogger";
import { Engine } from "./Engine";
import { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import { Random, seedFromClock } from "./Random";
import { SceneManager } from "./SceneManager";
import { Scheduler } from "./Scheduler";
import type { AsyncStage, ScheduleStage, SyncStage, SystemOptions } from "./Scheduler";
import type { AsyncSystemFn, GameServices, SyncSystemFn } from "./SystemCtx";

/**
 * Something that attaches to a game: a renderer, and later physics, audio or UI.
 *
 * `install` runs once, inside `createGame`, before the game runs. It registers systems and
 * may read `game.canvas`, `game.logger`, `game.assets` and `game.events`. It should not acquire
 * resources such as GPU contexts or listeners: do that in an `Init` system, and release them
 * with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.
 */
export interface Plugin {
  /** Namespaced, for example `fenrir.pixi2d` or `myGame.audio`. One plugin per name per game. */
  readonly name: string;
  install(game: Game): void | Promise<void>;
}

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
  // Seam for #37 (inspect): debug?: boolean;
}

/**
 * A running game. Built by `createGame`.
 *
 * Seams for M2 waves 2 and 3, left out on purpose until their tickets land:
 * - `resources` (#29), `states` (#30), `input` (#36): fields of GameServices
 *   in src/core/SystemCtx.ts, which Game extends, so they appear on `game` and `ctx` together.
 * - `onEnter` / `onExit` (#30) and `on` (#32): methods added below, under "Seams".
 * - `step` (#34) and `inspect` (#37): methods added below, under "Seams".
 */
export interface Game extends GameServices {
  readonly canvas: HTMLCanvasElement;
  readonly logger: ILogger;
  readonly assets: AssetStore;
  readonly events: EventBus;

  addSystem(stage: SyncStage, system: SyncSystemFn, options?: SystemOptions): this;
  addSystem(stage: AsyncStage, system: AsyncSystemFn, options?: SystemOptions): this;
  /** Removes every system called `name`. While running, it stops running from the next frame. */
  removeSystem(name: string): this;
  /** Swaps the function of every system called `name`, keeping its position and options. */
  replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;

  /** Runs PreInit, Init and PostInit, then resolves when the first frame is scheduled. */
  run(): Promise<void>;
  /** Runs Exit systems, then cleanups in reverse order. */
  stop(): Promise<void>;
  pause(): void;
  resume(): void;

  // Seams:
  // #30 states: onEnter(...) and onExit(...)

  // #32 immediate events: on(...)

  // #34 headless step: step(dt?: number, frames?: number): void

  // #37 inspect: inspect(): GameSnapshot
}

class GameImpl implements Game {
  public readonly canvas: HTMLCanvasElement;
  public readonly logger: ILogger;
  public readonly assets: AssetStore;
  public readonly events: EventBus;
  declare public readonly random: Random;
  private readonly engine: Engine;

  constructor(options: GameOptions, services: GameServices, clock: Clock) {
    this.canvas = options.canvas;
    this.logger = options.logger ?? new ConsoleLogger();
    this.assets = new AssetStore();
    this.events = new EventBus();
    Object.assign(this, services);
    this.engine = new Engine({
      scheduler: new Scheduler(),
      sceneManager: new SceneManager(this.logger),
      events: this.events,
      logger: this.logger,
      services,
      clock,
    });
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

  public run(): Promise<void> {
    return this.engine.run();
  }

  public stop(): Promise<void> {
    return this.engine.stop();
  }

  public pause(): void {
    this.engine.pause();
  }

  public resume(): void {
    this.engine.resume();
  }
}

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
  const services: GameServices = {
    // Seam for #29: resources: new Resources(),

    // Seam for #30: states: new States(),

    random: new Random(options.seed ?? seedFromClock(clock)),

    // Seam for #36: input: new Input(),
  };

  const game = new GameImpl(options, services, clock);

  const installed = new Set<string>();
  for (const plugin of options.plugins ?? []) {
    if (installed.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is listed twice in createGame's plugins. Remove one.`);
    }
    installed.add(plugin.name);
    try {
      await plugin.install(game);
    } catch (error) {
      game.logger.error(`Plugin "${plugin.name}" failed to install`, { error });
      throw error;
    }
  }

  return game;
}
