import type {
  AsyncStage,
  Scheduler,
  ScheduleStage,
  SyncStage,
} from "./Scheduler";
import { Schedule } from "./Scheduler";
import { Time } from "./Time";
import type { AsyncSystemFn, SyncSystemFn, SystemCtx } from "./SystemCtx";
import type { EventBus } from "./EventBus";
import type { SceneManager } from "./SceneManager";
import type { ILogger } from "./ILogger";
import { NullLogger } from "./NullLogger";

export type EngineOptions = {
  scheduler: Scheduler;
  sceneManager: SceneManager;
  events: EventBus;
  logger?: ILogger | null;
};

export class Engine {
  private readonly time = new Time();
  private readonly scheduler: Scheduler;

  private readonly events: EventBus;
  private readonly sceneManager: SceneManager;
  private readonly logger: ILogger;

  private running = false;
  private rafId: number | null = null;

  constructor(opts: EngineOptions) {
    this.scheduler = opts.scheduler;
    this.sceneManager = opts.sceneManager;
    this.events = opts.events;
    this.logger = opts.logger ?? new NullLogger();
  }

  private createSystemCtx(): SystemCtx {
    return {
      time: this.time,
      events: this.events,
      logger: this.logger,
      scenes: this.sceneManager,

      get scene() {
        return this.scenes.getActiveScene();
      },
      get entities() {
        return this.scenes.getActiveScene().entityList;
      },

      stop: () => this.stop(),
    };
  }

  public async run(): Promise<void> {
    if (this.running) return;

    this.running = true;

    const ctx = this.createSystemCtx();

    // Run async initialization stages sequentially
    await this.scheduler.runAsyncStage(Schedule.PreInit, ctx);
    await this.scheduler.runAsyncStage(Schedule.Init, ctx);
    await this.scheduler.runAsyncStage(Schedule.PostInit, ctx);

    const loop = () => {
      if (!this.running) return;

      this.time.update();

      // Pre-render/update phase
      this.scheduler.runSyncStage(Schedule.PreUpdate, ctx);

      // Fixed timestep updates
      while (this.time.accumulator >= this.time.tickRate) {
        this.scheduler.runSyncStage(Schedule.Tick, ctx);
        this.time.accumulator -= this.time.tickRate;
      }

      // Variable updates & rendering
      this.scheduler.runSyncStage(Schedule.Update, ctx);
      this.scheduler.runSyncStage(Schedule.PostUpdate, ctx);

      // Frame boundary: update event queues
      this.events.update();

      this.rafId = requestAnimationFrame(loop); // yield to the browser
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const ctx = this.createSystemCtx();

    await this.scheduler.runAsyncStage(Schedule.Exit, ctx);
  }

  public getTime(): Time {
    return this.time;
  }

  public isRunning(): boolean {
    return this.running;
  }

  // System Registration methods
  public addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn): this;
  public addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn): this;
  public addSystem(stage: ScheduleStage, system: any) {
    this.scheduler.addSystem(stage as any, system);
    return this;
  }

  public addSystems<S extends SyncStage>(
    stage: S,
    systems: readonly SyncSystemFn[]
  ): this;
  public addSystems<S extends AsyncStage>(
    stage: S,
    systems: readonly AsyncSystemFn[]
  ): this;
  public addSystems(stage: ScheduleStage, systems: readonly any[]) {
    this.scheduler.addSystems(stage as any, systems);
    return this;
  }
}
