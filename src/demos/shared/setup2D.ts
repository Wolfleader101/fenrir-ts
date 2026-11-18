import {
  Schedule,
  createGame,
  type AsyncSystemFn,
  type ILogger,
  type SyncSystemFn,
} from "@/index";
import { pixi2d } from "@/2d";
import type { Pixi2DOptions } from "@/2d";

/** Physics systems to run alongside the 2D renderer, from `createPhysicsSystem()`. */
type PhysicsSystems = { init: AsyncSystemFn; tick: SyncSystemFn; exit: AsyncSystemFn };

/**
 * Boots a 2D demo through `createGame` with the `pixi2d` plugin, then registers optional
 * physics. Uses only fenrir-ts and fenrir-ts/2d (and the physics systems passed in), so a 2D
 * demo loads no Three.js renderer, camera or skybox. Input needs no setup: `createGame` listens
 * on the canvas, and systems read actions from `ctx.input`.
 */
export async function createDemoGame2D(
  canvas: HTMLCanvasElement,
  opts: { logger?: ILogger; background?: number; design?: Pixi2DOptions["design"]; physics?: PhysicsSystems; debug?: boolean } = {},
) {
  const { background = 0x101010, design, physics, logger, debug } = opts;
  const pixi = pixi2d({ background, design });
  const game = await createGame({ canvas, logger, debug, plugins: [pixi] });
  if (physics) {
    game
      .addSystem(Schedule.Init, physics.init)
      .addSystem(Schedule.Tick, physics.tick)
      .addSystem(Schedule.Exit, physics.exit);
  }

  return { game, pixi };
}
