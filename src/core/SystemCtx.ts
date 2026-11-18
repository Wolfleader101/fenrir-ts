import type { EntityList } from "./ECS";
import type { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import type { Scene } from "./Scene";
import type { SceneManager } from "./SceneManager";
import type { Time } from "./Time";
import type { PhysicsHelpers } from "./Physics/PhysicsHelpers";

export type SystemCtx = {
  time: Time;
  events: EventBus;
  logger: ILogger;
  scenes: SceneManager;

  readonly scene: Scene;
  readonly entities: EntityList;

  // Physics helpers (set by PhysicsSystem when initialized)
  physics?: PhysicsHelpers;

  /** Aborted when the engine run that owns this context stops or rolls back. */
  readonly signal: AbortSignal;
  /** Registers cleanup for this run. Cleanups run in reverse order of registration. */
  onCleanup(cleanup: () => void | Promise<void>): void;
  stop(): void;
};

export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
