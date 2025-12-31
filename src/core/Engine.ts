import type { Scheduler, ScheduleStage } from "./Scheduler";
import { Schedule } from "./Scheduler";
import { Time } from "./Time";
import type { SystemCtx, SystemFn } from "./SystemCtx";
import type { EventBus } from "./EventBus";

// TODO: real implementations later
type Scene = {};

export class Engine {
  private readonly time = new Time();
  private readonly scheduler: Scheduler;

  private readonly scene: Scene;
  private readonly events: EventBus;

  private running = false;
  private rafId: number | null = null;

  constructor(opts: { scheduler: Scheduler; scene: Scene; events: EventBus }) {
    this.scheduler = opts.scheduler;
    this.scene = opts.scene;
    this.events = opts.events;
  }

  public run(): void {
    if (this.running) return;

    this.running = true;

    const ctx: SystemCtx = {
      time: this.time,
      scene: this.scene,
      events: this.events,
      stop: () => this.stop(),
    };

    this.start(ctx);

    const loop = () => {
      if (!this.running) return;

      this.time.update();

      // Pre-render/update phase
      this.scheduler.runStage(Schedule.PreUpdate, ctx);

      // Fixed timestep updates
      while (this.time.accumulator >= this.time.tickRate) {
        this.scheduler.runStage(Schedule.Tick, ctx);
        this.time.accumulator -= this.time.tickRate;
      }

      // Variable updates & rendering
      this.scheduler.runStage(Schedule.Update, ctx);
      this.scheduler.runStage(Schedule.PostUpdate, ctx);

      // Frame boundary: update event queues
      this.events.update();

      this.rafId = requestAnimationFrame(loop); // yield to the browser
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const ctx: SystemCtx = {
      time: this.time,
      scene: this.scene,
      events: this.events,
      stop: () => {},
    };

    this.scheduler.runStage(Schedule.Exit, ctx);
  }

  public getTime(): Time {
    return this.time;
  }

  public isRunning(): boolean {
    return this.running;
  }

  // System Registration methods
  public addSystem(stage: ScheduleStage, system: SystemFn) {
    this.scheduler.addSystem(stage, system);
    return this;
  }

  public addSystems(stage: ScheduleStage, systems: readonly SystemFn[]) {
    this.scheduler.addSystems(stage, systems);
    return this;
  }

  private start(ctx: SystemCtx) {
    // Run-once init phases
    this.scheduler.runStage(Schedule.PreInit, ctx);
    this.scheduler.runStage(Schedule.Init, ctx);
    this.scheduler.runStage(Schedule.PostInit, ctx);
  }
}
