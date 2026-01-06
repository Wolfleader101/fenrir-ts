import type { EntityList } from "./ECS";
import type { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import type { Scene } from "./Scene";
import type { SceneManager } from "./SceneManager";
import type { Time } from "./Time";
import type { SimplePhysicsWorld } from "./Physics";

export type SystemCtx = {
  time: Time;
  events: EventBus;
  logger: ILogger;
  scenes: SceneManager;

  readonly scene: Scene;
  readonly entities: EntityList;

  physics?: SimplePhysicsWorld; // TODO think of better way to expose physics

  stop(): void;
};

export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
