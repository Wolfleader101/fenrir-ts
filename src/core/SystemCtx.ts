import type { EntityList } from "./ECS";
import type { EventBus } from "./EventBus";
import type { ILogger } from "./ILogger";
import type { Scene } from "./Scene";
import type { SceneManager } from "./SceneManager";
import type { Time } from "./Time";

/**
 * Services a game shares between `Game` and every `SystemCtx`: `game.x` and `ctx.x` are the
 * same object. `createGame` builds them and passes them to the engine.
 *
 * Seams for M2 waves 2 and 3. Each ticket adds its one field on its own line below, builds the
 * object in `createGame` (src/core/Game.ts, the matching seam there), and needs no other change
 * to Game or the engine to reach both `game` and `ctx`.
 */
export interface GameServices {
  // #29 resources: readonly resources: Resources;

  // #30 states: readonly states: States;

  // #33 clock and random: readonly random: Random;

  // #36 input actions: readonly input: Input;
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
