import type { EntityList } from "./ECS";
import type { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import type { Scene } from "./Scene";
import type { SceneManager } from "./SceneManager";
import type { Time } from "./Time";

export type SystemCtx = {
  time: Time;
  events: EventBus;
  logger: ILogger;
  scenes: SceneManager;

  readonly scene: Scene;
  readonly entities: EntityList;

  stop(): void;
};

export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;

/**
 *
 * @deprecated This type is deprecated and just an alias.
 * Please use {@link SyncSystemFn} or {@link AsyncSystemFn} instead.
 */
export type SystemFn = SyncSystemFn;
