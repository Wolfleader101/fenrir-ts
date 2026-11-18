import { Schedule } from "./Schedule";
import type { AsyncSystemFn, SyncSystemFn } from "./SystemCtx";

// Kept apart from Scheduler.ts, so every entry that names its systems (2d, 3d, physics)
// does not bundle the scheduler.
const STAGES = Object.values(Schedule);

/**
 * Gives a system function a name. Internal: games pass `{ name }` to `addSystem`.
 */
export function nameSystem<F extends SyncSystemFn | AsyncSystemFn>(name: string, system: F): F {
  Object.defineProperty(system, "name", { value: name, configurable: true });
  return system;
}

/**
 * Names each stage-keyed function of a factory result `fenrir.<module>.<stage>`, for example
 * `{ init, update }` from module `pixi` becomes `fenrir.pixi.init` and `fenrir.pixi.update`.
 * This is the naming rule for every engine system. Internal.
 */
export function nameEngineSystems<T extends object>(module: string, systems: T): T {
  for (const stage of STAGES) {
    const system: unknown = (systems as Record<string, unknown>)[stage];
    if (typeof system === "function") nameSystem(`fenrir.${module}.${stage}`, system as SyncSystemFn);
  }
  return systems;
}
