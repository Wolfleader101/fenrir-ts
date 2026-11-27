import type { Engine } from "../core/Engine";
import type { UserScript, EngineState, OperationResult } from "./types";
import type { IEngineController } from "./interfaces";
import { Schedule } from "../core/Scheduler";
import type { ScheduleStage } from "../core/Scheduler";

export class LiveEngineController implements IEngineController {
  private state: EngineState = "stopped";
  private userSystems: UserScript = {};
  private readonly engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  getState(): EngineState {
    return this.state;
  }

  async start(userScript: UserScript): Promise<OperationResult> {
    if (this.state !== "stopped") {
      return {
        success: false,
        error: "Engine must be stopped before starting",
      };
    }

    try {
      this.unregisterUserSystems();
      this.userSystems = userScript;
      this.registerAsyncSystems(userScript);
      this.registerSyncSystems(userScript);

      await this.engine.run();
      this.state = "running";

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  pause(): OperationResult {
    if (this.state !== "running") {
      return { success: false, error: "Engine must be running to pause" };
    }

    this.engine.pause();
    this.state = "paused";
    return { success: true };
  }

  resume(): OperationResult {
    if (this.state !== "paused") {
      return { success: false, error: "Engine must be paused to resume" };
    }

    this.engine.resume();
    this.state = "running";
    return { success: true };
  }

  async restart(userScript: UserScript): Promise<OperationResult> {
    try {
      await this.engine.reset();
      this.state = "stopped";
      return await this.start(userScript);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  hotReload(userScript: UserScript): OperationResult {
    if (this.state === "stopped") {
      return {
        success: false,
        error: "Engine must be running or paused for hot-reload",
      };
    }

    try {
      this.replaceSyncSystems(userScript);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private registerAsyncSystems(userScript: UserScript): void {
    for (const stage of ASYNC_STAGES) {
      const system = userScript[stage];
      if (system) this.engine.addSystem(stage, system, { name: userSystemName(stage) });
    }
  }

  private registerSyncSystems(userScript: UserScript): void {
    for (const stage of SYNC_STAGES) {
      const system = userScript[stage];
      if (system) this.engine.addSystem(stage, system, { name: userSystemName(stage) });
    }
  }

  /** Removes the previous script's systems, so a restart does not register them twice. */
  private unregisterUserSystems(): void {
    const scheduler = this.engine.getScheduler();
    for (const stage of [...ASYNC_STAGES, ...SYNC_STAGES]) {
      const name = userSystemName(stage);
      if (scheduler.getSchedule(stage).some((system) => system.name === name)) this.engine.removeSystem(name);
    }
    this.userSystems = {};
  }

  /** Swaps the user's sync systems by name. Each takes effect from the next frame. */
  private replaceSyncSystems(userScript: UserScript): void {
    for (const stage of SYNC_STAGES) {
      const name = userSystemName(stage);
      const previous = this.userSystems[stage];
      const next = userScript[stage];
      if (previous && next) this.engine.replaceSystem(name, next);
      else if (previous) this.engine.removeSystem(name);
      else if (next) this.engine.addSystem(stage, next, { name });
    }

    this.userSystems = {
      ...this.userSystems,
      preUpdate: userScript.preUpdate,
      tick: userScript.tick,
      update: userScript.update,
      postUpdate: userScript.postUpdate,
    };
  }
}

const ASYNC_STAGES = [Schedule.PreInit, Schedule.Init, Schedule.PostInit, Schedule.Exit] as const;
const SYNC_STAGES = [Schedule.PreUpdate, Schedule.Tick, Schedule.Update, Schedule.PostUpdate] as const;

/** The name the editor registers a user script's system under, for example `fenrir.editor.update`. */
const userSystemName = (stage: ScheduleStage): string => `fenrir.editor.${stage}`;
