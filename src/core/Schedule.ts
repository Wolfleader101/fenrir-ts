// The stage names, apart from the Scheduler so entries that only register systems
// (fenrir-ts/2d's pixi2d) do not bundle the scheduler.
/** The stage names for `addSystem`. `PreInit`, `Init`, `PostInit` and `Exit` may be async and are awaited; `PreUpdate`, `Tick` (fixed step), `Update` and `PostUpdate` run every frame and must be sync. */
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

/** A value of `Schedule`. */
export type ScheduleStage = (typeof Schedule)[keyof typeof Schedule];

/** The stages whose systems may return a promise, which is awaited: `PreInit`, `Init`, `PostInit` and `Exit`. */
export type AsyncStage =
  | typeof Schedule.PreInit
  | typeof Schedule.Init
  | typeof Schedule.PostInit
  | typeof Schedule.Exit;

/** The per-frame stages. Their systems must be synchronous: a returned promise is not awaited. */
export type SyncStage = Exclude<ScheduleStage, AsyncStage>;
