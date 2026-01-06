import type { AsyncSystemFn, SyncSystemFn, SystemCtx } from "./SystemCtx";

export const Schedule = {
  PreInit: "preInit",
  Init: "init",
  PostInit: "postInit",
  PreUpdate: "preUpdate",
  Tick: "tick",
  Update: "update",
  PostUpdate: "postUpdate",
  Exit: "exit",
} as const;

export type ScheduleStage = (typeof Schedule)[keyof typeof Schedule];

export type AsyncStage =
  | typeof Schedule.PreInit
  | typeof Schedule.Init
  | typeof Schedule.PostInit
  | typeof Schedule.Exit;

export type SyncStage = Exclude<ScheduleStage, AsyncStage>;

const ALL_STAGES = Object.values(Schedule);

type StageRecord = {
  [K in SyncStage]: SyncSystemFn[];
} & {
  [K in AsyncStage]: AsyncSystemFn[];
};

function createStageRecord(): StageRecord {
  const record = {} as StageRecord;
  ALL_STAGES.forEach((s) => {
    (record as any)[s] = [];
  });
  return record;
}

const isPromise = (v: any): v is Promise<any> =>
  v != null && typeof v.then === "function";

export class Scheduler {
  private readonly stages = createStageRecord();

  public addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn): this;
  public addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn): this;
  public addSystem(stage: ScheduleStage, system: any) {
    this.stages[stage as keyof StageRecord].push(system);
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
    systems.forEach((s) => this.addSystem(stage as any, s));
    return this;
  }

  public getSystems(stage: ScheduleStage) {
    return this.stages[stage];
  }

  public runSyncStage<S extends SyncStage>(stage: S, ctx: SystemCtx) {
    for (const system of this.stages[stage]) system(ctx);
  }

  public async runAsyncStage<S extends AsyncStage>(stage: S, ctx: SystemCtx) {
    for (const system of this.stages[stage]) {
      const res = system(ctx);
      if (isPromise(res)) await res;
    }
  }
}
