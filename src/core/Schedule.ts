// The stage names, apart from the Scheduler so entries that only register systems
// (fenrir-ts/2d's pixi2d) do not bundle the scheduler.
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
