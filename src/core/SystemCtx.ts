import type { EntityList } from "./ECS";
import type { EventBus } from "./EventBus";
import type { Resources } from "./Resource";
import type { ILogger } from "./ILogger";
import type { Scene } from "./Scene";
import type { SceneManager } from "./SceneManager";
import type { Random } from "./Random";
import type { States } from "./State";
import type { Time } from "./Time";
import type { Input } from "./Input/Input";

/**
 * Services a game shares between `Game` and every `SystemCtx`: `game.x` and `ctx.x` are the
 * same object. `createGame` builds them and passes them to the engine.
 *
 * A new service adds its field here and builds its object in `createServices` (src/core/Game.ts).
 */
export interface GameServices {
  /** Singleton values this game owns. See `defineResource`. */
  readonly resources: Resources;

  /** The current value of each state. See `defineState`. */
  readonly states: States;

  /** Seeded random numbers. Use instead of `Math.random()`. Seeded by `createGame({ seed })`. */
  readonly random: Random;

  /** Actions and the pointer, latched when each frame starts. See `defineAction`. */
  readonly input: Input;
}

/**
 * What every system receives. An interface so that entry points can add fields:
 * `fenrir-ts/physics` adds `physics`.
 */
export interface SystemCtx extends GameServices {
  time: Time;
  events: EventBus;
  logger: ILogger;
  scenes: SceneManager;

  readonly scene: Scene;
  readonly entities: EntityList;

  /** Aborted when the engine run that owns this context stops or rolls back. */
  readonly signal: AbortSignal;
  /** Registers cleanup for this run. Cleanups run in reverse order of registration. */
  onCleanup(cleanup: () => void | Promise<void>): void;
  stop(): void;
}

export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
