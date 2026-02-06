import type { SyncSystemFn, AsyncSystemFn } from "@/core/SystemCtx";

export type EngineState = "stopped" | "running" | "paused";

export interface UserScript {
  // Async schedules
  readonly preInit?: AsyncSystemFn;
  readonly init?: AsyncSystemFn;
  readonly postInit?: AsyncSystemFn;
  readonly exit?: AsyncSystemFn;

  // Sync schedules
  readonly preUpdate?: SyncSystemFn;
  readonly tick?: SyncSystemFn;
  readonly update?: SyncSystemFn;
  readonly postUpdate?: SyncSystemFn;
}

export interface OperationResult {
  readonly success: boolean;
  readonly error?: string;
}
