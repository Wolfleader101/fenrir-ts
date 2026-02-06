import type { Engine } from "@/core/Engine";
import type { UserScript, EngineState, OperationResult } from "@/editor/types";
import type { IEngineController } from "./interfaces";
import { Schedule } from "@/core/Scheduler";
import type { SyncSystemFn } from "@/core/SystemCtx";

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
      // TODO this doesnt actually work right now, the "old code" will still be there and cause issues. We need a way to fully replace the old systems with the new ones.
      // We need to store a ref of some kind to be able to replace it.
      // i.e right now if you have an update that prints "test" and you change it to print "hello", both systems will be registered and you'll get both "test" and "hello" in the console.
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
    if (userScript.preInit) {
      this.engine.addSystem(Schedule.PreInit, userScript.preInit);
    }
    if (userScript.init) {
      this.engine.addSystem(Schedule.Init, userScript.init);
    }
    if (userScript.postInit) {
      this.engine.addSystem(Schedule.PostInit, userScript.postInit);
    }
    if (userScript.exit) {
      this.engine.addSystem(Schedule.Exit, userScript.exit);
    }
  }

  private registerSyncSystems(userScript: UserScript): void {
    if (userScript.preUpdate) {
      this.engine.addSystem(Schedule.PreUpdate, userScript.preUpdate);
    }
    if (userScript.tick) {
      this.engine.addSystem(Schedule.Tick, userScript.tick);
    }
    if (userScript.update) {
      this.engine.addSystem(Schedule.Update, userScript.update);
    }
    if (userScript.postUpdate) {
      this.engine.addSystem(Schedule.PostUpdate, userScript.postUpdate);
    }
  }

  private replaceSyncSystems(userScript: UserScript): void {
    const scheduler = this.engine.getScheduler();

    const replaceSystem = (
      schedule:
        | typeof Schedule.PreUpdate
        | typeof Schedule.Tick
        | typeof Schedule.Update
        | typeof Schedule.PostUpdate,
      oldSystem: SyncSystemFn | undefined,
      newSystem: SyncSystemFn | undefined,
    ): void => {
      const systems: SyncSystemFn[] = scheduler
        .getSystems(schedule)
        .filter((sys) => sys !== oldSystem) as SyncSystemFn[];

      if (newSystem) {
        systems.push(newSystem);
      }

      scheduler.replaceSystems(schedule, systems);
    };

    replaceSystem(
      Schedule.PreUpdate,
      this.userSystems.preUpdate,
      userScript.preUpdate,
    );
    replaceSystem(Schedule.Tick, this.userSystems.tick, userScript.tick);
    replaceSystem(Schedule.Update, this.userSystems.update, userScript.update);
    replaceSystem(
      Schedule.PostUpdate,
      this.userSystems.postUpdate,
      userScript.postUpdate,
    );

    // Update stored systems
    this.userSystems = {
      ...this.userSystems,
      preUpdate: userScript.preUpdate,
      tick: userScript.tick,
      update: userScript.update,
      postUpdate: userScript.postUpdate,
    };
  }
}
