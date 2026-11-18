import type {
  AsyncStage,
  Scheduler,
  ScheduleStage,
  SyncStage,
  SystemOptions,
} from "./Scheduler";
import { Schedule } from "./Scheduler";
import { Time } from "./Time";
import type { AsyncSystemFn, GameServices, SyncSystemFn, SystemCtx } from "./SystemCtx";
import type { EventBus } from "./EventBus";
import type { SceneManager } from "./SceneManager";
import type { ILogger } from "./ILogger";
import { NullLogger } from "./NullLogger";

export type EngineOptions = {
  scheduler: Scheduler;
  sceneManager: SceneManager;
  events: EventBus;
  logger?: ILogger | null;
  /** Maximum simulation delta in seconds. Defaults to 0.25. */
  maxFrameDelta?: number;
  /** Maximum fixed updates per animation frame. Defaults to 8. */
  maxTicksPerFrame?: number;
  /** Fields added to every SystemCtx. `createGame` passes the game's services here. */
  services?: GameServices;
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

export class Engine {
  private readonly time = new Time();
  private readonly scheduler: Scheduler;
  private readonly maxFrameDelta: number;
  private readonly maxTicksPerFrame: number;

  private readonly events: EventBus;
  private readonly sceneManager: SceneManager;
  private readonly logger: ILogger;
  private readonly services: GameServices;

  private activeRun?: EngineRun;
  private rafId: number | null = null;

  constructor(opts: EngineOptions) {
    this.scheduler = opts.scheduler;
    this.sceneManager = opts.sceneManager;
    this.events = opts.events;
    this.logger = opts.logger ?? new NullLogger();
    this.services = opts.services ?? {};
    this.maxFrameDelta = opts.maxFrameDelta ?? 0.25;
    this.maxTicksPerFrame = opts.maxTicksPerFrame ?? 8;
    if (!Number.isFinite(this.maxFrameDelta) || this.maxFrameDelta <= 0) {
      throw new RangeError("maxFrameDelta must be a positive finite number in seconds");
    }
    if (!Number.isSafeInteger(this.maxTicksPerFrame) || this.maxTicksPerFrame <= 0) {
      throw new RangeError("maxTicksPerFrame must be a positive integer");
    }
  }

  private createSystemCtx(run: EngineRun): SystemCtx {
    const ctx: SystemCtx = {
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
    return Object.assign(ctx, this.services);
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
    this.time.reset();

    try {
      for (const stage of [Schedule.PreInit, Schedule.Init, Schedule.PostInit]) {
        // Systems added by an earlier startup stage run from the next stage.
        this.scheduler.flush();
        for (const { system, runIf } of this.scheduler.current(stage)) {
          if (run.controller.signal.aborted) break;
          if (runIf && !runIf(ctx)) continue;
          await system(ctx);
        }
      }
      if (!run.controller.signal.aborted) {
        this.time.reset();
        run.state = "running";
        this.scheduleFrame(run, ctx);
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
        this.frame(run, ctx);
      } catch (error) {
        ctx.stop();
        throw error;
      }

      if (run.state === "running" && this.rafId === null) this.scheduleFrame(run, ctx);
    });
  }

  private frame(run: EngineRun, ctx: SystemCtx): void {
    // Systems added, replaced or removed since the last frame take effect now.
    this.scheduler.flush();
    this.time.update(this.maxFrameDelta);
    this.scheduler.runSyncStage(Schedule.PreUpdate, ctx);

    const step = this.time.fixedDeltaTime;
    if (run.state !== "running") return;
    if (!Number.isFinite(step) || step <= 0) throw new RangeError("tickRate must be positive and finite");

    for (let ticks = 0; this.time.accumulator >= step && ticks < this.maxTicksPerFrame; ticks++) {
      this.scheduler.runSyncStage(Schedule.Tick, ctx);
      this.time.accumulator -= step;
      if (run.state !== "running") return;
    }
    if (this.time.accumulator >= step) this.time.accumulator %= step;

    this.scheduler.runSyncStage(Schedule.Update, ctx);
    if (run.state !== "running") return;
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
        for (const { system, runIf } of this.scheduler.current(Schedule.Exit)) {
          try {
            if (runIf && !runIf(ctx)) continue;
            await system(ctx);
          } catch (error) { failures.push(error); }
        }
        for (const cleanup of run.cleanups.reverse()) {
          try { await cleanup(); } catch (error) { failures.push(error); }
        }
        if (failures.length > 0) throw new AggregateError(failures, "Engine shutdown failed");
      } finally {
        this.events.clear();
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
    const run = this.activeRun;
    if (run?.state !== "paused") return;
    run.state = "running";
    this.time.resume();
    this.scheduleFrame(run, run.ctx!);
  }

  public async reset(): Promise<void> {
    const wasRunning = this.isRunning();
    await this.stop();
    this.sceneManager.getActiveScene().entityList.clear();
    this.time.reset();
    if (wasRunning) await this.run();
  }

  public getTime(): Time {
    return this.time;
  }

  public isRunning(): boolean {
    return this.activeRun?.state === "running";
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
