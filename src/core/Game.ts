import { AssetStore } from "./Assets/AssetStore";
import { realClock } from "./Clock";
import type { Clock } from "./Clock";
import { ConsoleLogger } from "./ConsoleLogger";
import { Engine } from "./Engine";
import { Resources } from "./Resource";
import { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import { Random, seedFromClock } from "./Random";
import { SceneManager } from "./SceneManager";
import { Scheduler } from "./Scheduler";
import { GameStates } from "./State";
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
 * - `input` (#36): fields of GameServices
 *   in src/core/SystemCtx.ts, which Game extends, so they appear on `game` and `ctx` together.
 * - `on` (#32): a method added below, under "Seams".
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

  /**
   * Runs `system` each time `state` changes to `value`, after the exit hooks of the old value.
   * Each run starts every state at its initial value and runs its enter hooks before the first PreInit system.
   */
  onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
  /** Runs `system` each time `state` changes away from `value`, before the enter hooks of the new value. */
  onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;

  // Seams:
  // #32 immediate events: on(...)

  // #34 headless step: step(dt?: number, frames?: number): void

  // #37 inspect: inspect(): GameSnapshot
}

class GameImpl implements Game {
  declare public readonly resources: Resources;
  public readonly canvas: HTMLCanvasElement;
  public readonly logger: ILogger;
  public readonly assets: AssetStore;
  public readonly events: EventBus;
  declare public readonly random: Random;
  declare public readonly states: States;
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

  public onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this {
    gameStates(this).hook("enter", state, value, system);
    return this;
  }

  public onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this {
    gameStates(this).hook("exit", state, value, system);
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
  const services: GameServices = {
    resources: new Resources(),

    states: new GameStates(),

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
