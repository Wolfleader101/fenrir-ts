// Names that README fragments assume from the code around them.
// Used only by scripts/check-docs.mjs.
import type { Engine, Game, SyncSystemFn, AsyncSystemFn } from "../src/index";

declare global {
  /** The engine built in the 3D example. */
  const engine: Engine;
  /** The game built in the quick start. */
  const game: Game;
  /** A Pixi display object an example adds to the stage. */
  const myOverlay: import("pixi.js").Container;
  const Schedule: typeof import("../src/index").Schedule;

  /** Placeholder systems that examples register. */
  const yourGameSystem: SyncSystemFn;
  const movementSystem: SyncSystemFn;
  const renderSystem: SyncSystemFn;
}
