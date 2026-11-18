import {
  Schedule,
  createDomInputSystems,
  createGame,
  createInputStateSystem,
  type AsyncSystemFn,
  type ILogger,
  type SyncSystemFn,
} from "@/index";
import { pixi2d } from "@/2d";

/** Physics systems to run alongside the 2D renderer, from `createPhysicsSystem()`. */
type PhysicsSystems = { init: AsyncSystemFn; tick: SyncSystemFn; exit: AsyncSystemFn };

/**
 * Boots a 2D demo through `createGame` with the `pixi2d` plugin, then registers DOM input,
 * input state and optional physics. Uses only fenrir-ts and fenrir-ts/2d (and the physics
 * systems passed in), so a 2D demo loads no Three.js renderer, camera or skybox.
 *
 * Input is registered here until input actions (#36) give `createGame` its own input.
 */
export async function createDemoGame2D(
  canvas: HTMLCanvasElement,
  opts: { logger?: ILogger; background?: number; physics?: PhysicsSystems } = {},
) {
  const { background = 0x101010, physics, logger } = opts;
  const pixi = pixi2d({ background });
  const game = await createGame({ canvas, logger, plugins: [pixi] });

  const domInput = createDomInputSystems();
  const input = createInputStateSystem();
  game
    .addSystem(Schedule.Init, domInput.init)
    .addSystem(Schedule.PreUpdate, input.preUpdate)
    .addSystem(Schedule.Exit, domInput.exit);
  if (physics) {
    game
      .addSystem(Schedule.Init, physics.init)
      .addSystem(Schedule.Tick, physics.tick)
      .addSystem(Schedule.Exit, physics.exit);
  }

  return { game, input, pixi };
}
