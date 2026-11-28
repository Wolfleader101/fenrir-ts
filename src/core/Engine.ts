import type {
  AsyncStage,
  Scheduler,
  ScheduleStage,
  SyncStage,
  SystemOptions,
} from "./Scheduler";
import { Schedule } from "./Scheduler";
import { Time } from "./Time";
import type { Clock } from "./Clock";
import { realClock } from "./Clock";
import { Random, seedFromClock } from "./Random";
import type { AsyncSystemFn, GameServices, SyncSystemFn, SystemCtx } from "./SystemCtx";
import { beginEventRun, endEventRun, setEventTick, type EventBus } from "./EventBus";
import type { SceneManager } from "./SceneManager";
import type { ILogger } from "./ILogger";
import { NullLogger } from "./NullLogger";
import { Resources, clearResources } from "./Resource";
import { GameStates, afterSystem, beforeStage } from "./State";
import { InputImpl } from "./Input/Input";
import { AssetStore } from "./Assets/AssetStore";

/** What `new Engine(options)` takes. 2D games use `createGame` instead. */
export type EngineOptions = {
  scheduler: Scheduler;
  sceneManager: SceneManager;
  events: EventBus;
  logger?: ILogger | null;
  /** Maximum simulation delta in seconds. Defaults to 0.25. */
  maxFrameDelta?: number;
  /** Maximum fixed updates per animation frame: a positive integer. Defaults to 8. */
  maxTicksPerFrame?: number;
  /** Seconds per fixed tick, set on `time.fixedDelta` before the first frame: a positive finite number. Defaults to 1/60. */
  fixedDelta?: number;
  /**
   * Fields added to every SystemCtx. `createGame` passes the game's services here. Without
   * them, the engine makes its own, with `random` seeded from the clock.
   */
  services?: GameServices;
  /** Where `ctx.time` reads time. Defaults to the real clock; pass one you control in tests. */
  clock?: Clock;
  /**
   * What drives frames once startup finishes. `"animationFrame"`, the default, schedules them
   * with `requestAnimationFrame`. `"step"` schedules none: the engine stays paused after
   * startup, frames run only through `step(dt)`, and `resume()` throws. `createTestGame` uses
   * `"step"`.
   */
  loop?: "animationFrame" | "step";
  /** Called before each frame that `step` runs, with its `dt`. The test game advances its clock here. */
  beforeStep?: (dt: number) => void;
};

type Lifecycle = "starting" | "running" | "paused" | "stopping";

type EngineRun = {
  state: Lifecycle;
  controller: AbortController;
  cleanups: Array<() => void | Promise<void>>;
  startup: Promise<void>;
  shutdown?: Promise<void>;
  ctx?: SystemCtx;
};

/** The frame loop and lifecycle under a `Game`. 2D games use `createGame`; `Engine` stays exported for the 3D path. */
export class Engine {
  private readonly time: Time;
  private readonly scheduler: Scheduler;
  private readonly maxFrameDelta: number;
  private readonly maxTicksPerFrame: number;

  private readonly events: EventBus;
  private readonly sceneManager: SceneManager;
  private readonly logger: ILogger;
  private readonly services: GameServices;

  private readonly loop: "animationFrame" | "step";
  private readonly beforeStep?: (dt: number) => void;

  private activeRun?: EngineRun;
  private rafId: number | null = null;
  private stepping = false;
  /** Frames run this run, and `time.elapsed` at the latest one's start. Read by `inspect`. */
  private frames = { count: 0, elapsed: 0 };

  constructor(opts: EngineOptions) {
    this.scheduler = opts.scheduler;
    this.sceneManager = opts.sceneManager;
    this.events = opts.events;
    this.logger = opts.logger ?? new NullLogger();
    const clock = opts.clock ?? realClock;
    this.time = new Time(clock);
    const resources = new Resources();
    this.services = opts.services ?? {
      resources,
      random: new Random(seedFromClock(clock)),
      states: new GameStates(),
      input: new InputImpl(resources),
      assets: new AssetStore(),
    };
    this.loop = opts.loop ?? "animationFrame";
    this.beforeStep = opts.beforeStep;
    this.maxFrameDelta = opts.maxFrameDelta ?? 0.25;
    this.maxTicksPerFrame = opts.maxTicksPerFrame ?? 8;
    if (!Number.isFinite(this.maxFrameDelta) || this.maxFrameDelta <= 0) {
      throw new RangeError("maxFrameDelta must be a positive finite number in seconds");
    }
    if (!Number.isSafeInteger(this.maxTicksPerFrame) || this.maxTicksPerFrame <= 0) {
      throw new RangeError("maxTicksPerFrame must be a positive integer");
    }
    if (opts.fixedDelta !== undefined) {
      if (!Number.isFinite(opts.fixedDelta) || opts.fixedDelta <= 0) {
        throw new RangeError("fixedDelta must be a positive finite number in seconds");
      }
      this.time.fixedDelta = opts.fixedDelta;
    }
  }

  private createSystemCtx(run: EngineRun): SystemCtx {
    const ctx: SystemCtx = {
      ...this.services,
      time: this.time,
      events: this.events,
      logger: this.logger,
      scenes: this.sceneManager,
      signal: run.controller.signal,
      onCleanup: (cleanup) => {
        if (run.shutdown) throw new Error("Cannot register cleanup during shutdown");
        run.cleanups.push(cleanup);
      },

      get scene() {
        return this.scenes.getActiveScene();
      },
      get entities() {
        return this.scenes.getActiveScene().entityList;
      },

      stop: () => {
        if (this.activeRun !== run || run.state === "stopping") return;
        void this.stop().catch((error: unknown) => this.logger.error("Engine shutdown failed", { error }));
      },
    };
    return ctx;
  }

  public run(): Promise<void> {
    if (this.activeRun) {
      const active = this.activeRun;
      return active.state === "stopping" && active.shutdown
        ? active.shutdown.then(() => this.run())
        : active.startup;
    }

    // Resolve system order first: a bad before/after rejects the run before any system runs.
    try {
      this.scheduler.beginRun();
    } catch (error) {
      return Promise.reject(error);
    }

    const run: EngineRun = {
      state: "starting",
      controller: new AbortController(),
      cleanups: [],
      startup: Promise.resolve().then(() => this.start(run)),
    };
    this.activeRun = run;
    return run.startup;
  }

  private async start(run: EngineRun): Promise<void> {
    const ctx = (run.ctx = this.createSystemCtx(run));
    // Immediate listeners receive this run's ctx, from PreInit until the last cleanup.
    beginEventRun(this.events, ctx);
    // Listeners for this run; removed when it stops or rolls back.
    this.input.start(ctx);
    this.time.reset();
    this.frames = { count: 0, elapsed: 0 };

    try {
      for (const stage of [Schedule.PreInit, Schedule.Init, Schedule.PostInit]) {
        // Systems added by an earlier startup stage run from the next stage.
        this.scheduler.flush();
        await this.scheduler.runAsyncStage(stage, ctx);
      }
      if (!run.controller.signal.aborted) {
        this.time.reset();
        if (this.loop === "step") {
          // Frames come only from step(dt), which runs while paused.
          run.state = "paused";
          this.time.pause();
        } else {
          run.state = "running";
          this.scheduleFrame(run, ctx);
        }
        return;
      }
    } catch (error) {
      try {
        await this.shutdown(run, ctx);
      } catch (cleanupError) {
        this.logger.error("Engine startup rollback failed", { error: cleanupError });
      }
      throw error;
    }

    await this.shutdown(run, ctx);
  }

  private scheduleFrame(run: EngineRun, ctx: SystemCtx): void {
    this.rafId = requestAnimationFrame(() => {
      if (this.activeRun !== run || run.state !== "running") return;
      this.rafId = null;

      try {
        this.frame(run, ctx, "running");
      } catch (error) {
        ctx.stop();
        throw error;
      }

      if (run.state === "running" && this.rafId === null) this.scheduleFrame(run, ctx);
    });
  }

  /**
   * One frame. The browser loop calls it with `live` "running"; `step` calls it with "paused"
   * and an exact `dt`. A system that stops or pauses the run ends the frame early.
   */
  private frame(run: EngineRun, ctx: SystemCtx, live: Lifecycle, dt?: number): void {
    // Systems added, replaced or removed since the last frame take effect now.
    this.scheduler.flush();
    this.time.update(this.maxFrameDelta, dt);
    this.frames.count++, (this.frames.elapsed = this.time.elapsed);
    // Edges are latched here, so every system in the frame reads the same input.
    this.input.latch();
    this.scheduler.runSyncStage(Schedule.PreUpdate, ctx);

    const step = this.time.fixedDelta;
    if (run.state !== live) return;
    if (!Number.isFinite(step) || step <= 0) throw new RangeError(`time.fixedDelta must be a positive finite number of seconds, got ${step}`);

    for (let ticks = 0; this.time.accumulator >= step && ticks < this.maxTicksPerFrame; ticks++) {
      this.time["tickCount"]++;
      this.input.tick(true);
      setEventTick(this.events, true);
      try {
        this.scheduler.runSyncStage(Schedule.Tick, ctx);
      } finally {
        setEventTick(this.events, false);
        this.input.tick(false);
      }
      this.time.accumulator -= step;
      if (run.state !== live) return;
    }
    if (this.time.accumulator >= step) this.time.accumulator %= step;

    this.scheduler.runSyncStage(Schedule.Update, ctx);
    if (run.state !== live) return;
    this.scheduler.runSyncStage(Schedule.PostUpdate, ctx);
    this.events.update();
  }

  private cancelFrame(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private shutdown(run: EngineRun, ctx: SystemCtx): Promise<void> {
    if (run.shutdown) return run.shutdown;
    run.state = "stopping";
    this.cancelFrame();

    run.shutdown = Promise.resolve().then(async () => {
      const failures: unknown[] = [];
      try {
        this.scheduler.flush();
        beforeStage(Schedule.Exit, ctx);
        for (const { system, runIf } of this.scheduler.current(Schedule.Exit)) {
          try {
            if (runIf && !runIf(ctx)) continue;
            await system(ctx);
            afterSystem(ctx);
          } catch (error) { failures.push(error); }
        }
        for (const cleanup of run.cleanups.reverse()) {
          try { await cleanup(); } catch (error) { failures.push(error); }
        }
        if (failures.length > 0) throw new AggregateError(failures, "Engine shutdown failed");
      } finally {
        this.events.clear();
        endEventRun(this.events);
        this.scheduler.endRun();
        this.activeRun = undefined;
      }
    });
    run.controller.abort();
    return run.shutdown;
  }

  public stop(): Promise<void> {
    const run = this.activeRun;
    if (!run) return Promise.resolve();
    if (run.shutdown) return run.shutdown;

    if (run.state === "starting") {
      run.controller.abort();
      return run.startup.then(() => run.shutdown, () => run.shutdown);
    }

    return this.shutdown(run, run.ctx!);
  }

  public pause(): void {
    const run = this.activeRun;
    if (run?.state !== "running") return;
    run.state = "paused";
    this.cancelFrame();
    this.time.pause();
  }

  public resume(): void {
    if (this.loop === "step") throw new Error("A test game has no frame loop to resume. Run frames with step(dt).");
    const run = this.activeRun;
    if (run?.state !== "paused") return;
    run.state = "running";
    this.time.resume();
    this.scheduleFrame(run, run.ctx!);
  }

  /**
   * Runs `frames` whole frames now, each `dt` seconds long, through the same frame body as the
   * browser loop: PreUpdate, as many Tick stages as the accumulator holds (at most
   * `maxTicksPerFrame`, the rest dropped), Update, PostUpdate, then the event buffers advance.
   *
   * Runs only while paused: after `pause()`, or after startup with `loop: "step"`. `dt` is in
   * seconds, from 0 up to `maxFrameDelta` (0.25 by default); a longer `dt` throws instead of
   * being clamped, because a clamped step would silently simulate less time than asked for.
   * If a system stops the run, the remaining frames are skipped. If a system throws, the run
   * stops, as in the browser loop, and the error propagates.
   */
  public step(dt = 1 / 60, frames = 1): void {
    const max = this.maxFrameDelta;
    if (!(dt >= 0 && dt <= max)) {
      throw new RangeError(
        `step(dt) runs one frame of 0 to ${max} s (the frame-delta clamp), got ${dt}.` +
        (dt > max ? ` To advance ${dt} s, step more frames: step(1 / 60, ${Math.ceil(dt * 60)}).` : ""),
      );
    }
    if (!Number.isSafeInteger(frames) || frames < 1) {
      throw new RangeError(`step(dt, frames) needs frames to be a whole number of at least 1, got ${frames}.`);
    }
    if (this.stepping) throw new Error("step(dt) was called from inside a frame. Call it from test or tool code, not from a system.");

    const run = this.activeRun;
    if (run?.state !== "paused") {
      throw new Error(this.loop === "step"
        ? "step(dt) needs a started game. Await start() first, and start() again after stop()."
        : `step(dt) runs only while the game is paused. ${run?.state === "running" ? "Call pause() first" : "Await run(), then pause()"}: requestAnimationFrame drives a running game.`);
    }

    this.stepping = true;
    try {
      for (let i = 0; i < frames && this.activeRun === run && run.state === "paused"; i++) {
        this.beforeStep?.(dt);
        try {
          this.frame(run, run.ctx!, "paused", dt);
        } catch (error) {
          run.ctx!.stop();
          throw error;
        }
      }
    } finally {
      this.stepping = false;
    }
  }

  public async reset(): Promise<void> {
    const wasRunning = this.isRunning();
    await this.stop();
    this.sceneManager.getActiveScene().entityList.clear();
    clearResources(this.services.resources);
    this.time.reset();
    if (wasRunning) await this.run();
  }

  private get input(): InputImpl {
    return this.services.input as InputImpl;
  }

  public getTime(): Time {
    return this.time;
  }

  public isRunning(): boolean {
    return this.activeRun?.state === "running";
  }

  /** Whether startup finished and the run has not begun to stop: running or paused. */
  public isActive(): boolean {
    const state = this.activeRun?.state;
    return state === "running" || state === "paused";
  }

  // System registration
  public addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
  public addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
  public addSystem(stage: ScheduleStage, system: SyncSystemFn | AsyncSystemFn, options?: SystemOptions): this {
    this.scheduler.addSystem(stage as SyncStage, system as SyncSystemFn, options);
    return this;
  }

  public addSystems<S extends SyncStage>(
    stage: S,
    systems: readonly SyncSystemFn[],
  ): this;
  public addSystems<S extends AsyncStage>(
    stage: S,
    systems: readonly AsyncSystemFn[],
  ): this;
  public addSystems(stage: ScheduleStage, systems: readonly (SyncSystemFn | AsyncSystemFn)[]): this {
    this.scheduler.addSystems(stage as SyncStage, systems as readonly SyncSystemFn[]);
    return this;
  }

  /** Swaps the function of the system called `name`, keeping its position and options. */
  public replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this {
    this.scheduler.replaceSystem(name, system);
    return this;
  }

  /** Removes the system called `name`. While running, it stops from the next frame. */
  public removeSystem(name: string): this {
    this.scheduler.removeSystem(name);
    return this;
  }

  public getScheduler(): Scheduler {
    return this.scheduler;
  }
}
