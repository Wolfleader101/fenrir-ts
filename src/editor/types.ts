import type { SyncSystemFn, AsyncSystemFn, SystemCtx } from "@/core/SystemCtx";

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

/**
 * The engine state exposed to live scripts. It is built outside an engine run,
 * so it has no run lifetime ({@link SystemCtx.signal}, {@link SystemCtx.onCleanup}).
 */
export type SandboxContext = Omit<SystemCtx, "signal" | "onCleanup">;
