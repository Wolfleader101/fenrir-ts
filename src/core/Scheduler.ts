import type { SystemCtx, SystemFn } from "./SystemCtx";

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

const ALL_STAGES = Object.values(Schedule);

type StageRecord = Record<ScheduleStage, SystemFn[]>;

function createStageRecord() {
  // Ensure every stage exists and maintains stable order
  const record = {} as StageRecord;
  for (const s of ALL_STAGES) record[s] = [];
  return record;
}

export class Scheduler {
  private readonly stages: Record<ScheduleStage, SystemFn[]> =
    createStageRecord();

  public addSystem(stage: ScheduleStage, system: SystemFn) {
    this.stages[stage].push(system);
    return this;
  }

  public addSystems(stage: ScheduleStage, systems: readonly SystemFn[]) {
    systems.forEach((s) => this.addSystem(stage, s));
    return this;
  }

  public getSystems(stage: ScheduleStage) {
    return this.stages[stage];
  }

  public runStage(stage: ScheduleStage, ctx: SystemCtx) {
    // stable insertion order
    for (const system of this.stages[stage]) {
      system(ctx);
    }
  }
}
