// Names that README fragments assume from the code around them.
// Used only by scripts/check-docs.mjs.
import type { Engine, SyncSystemFn, AsyncSystemFn } from "../src/core/index";

declare global {
  /** The engine built in the quick start. */
  const engine: Engine;
  const Schedule: typeof import("../src/core/index").Schedule;

  /** Placeholder systems that examples register. */
  const yourGameSystem: SyncSystemFn;
  const movementSystem: SyncSystemFn;
  const renderSystem: SyncSystemFn;
  const input: { init: AsyncSystemFn };
  const renderer: { init: AsyncSystemFn };
}
