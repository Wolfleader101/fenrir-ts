import {
  AssetStore,
  Schedule,
  createDomInputSystems,
  createInputStateSystem,
  type AsyncSystemFn,
  type Engine,
  type ILogger,
  type SyncSystemFn,
} from "@/index";
import { createPixiRendererSystem } from "@/2d";

/** Physics systems to run alongside the 2D renderer, from `createPhysicsSystem()`. */
type PhysicsSystems = { init: AsyncSystemFn; tick: SyncSystemFn; exit: AsyncSystemFn };

/**
 * Registers what a 2D demo needs: DOM input, input state and the Pixi renderer,
 * in the order bootstrapEngine used for its old 2D mode. Uses only fenrir-ts and
 * fenrir-ts/2d, so a 2D demo loads no Three.js renderer, camera or skybox.
 */
export function setup2D(
  engine: Engine,
  logger: ILogger,
  canvas: HTMLCanvasElement,
  opts: { clearColor?: number; physics?: PhysicsSystems } = {},
) {
  const { clearColor = 0x101010, physics } = opts;
  const assets = new AssetStore();
  const domInput = createDomInputSystems();
  const input = createInputStateSystem();
  const renderer = createPixiRendererSystem({ logger, canvas, clearColor, assets });

  engine
    .addSystems(Schedule.Init, [domInput.init, renderer.init, ...(physics ? [physics.init] : [])])
    .addSystems(Schedule.PreUpdate, [input.preUpdate])
    .addSystems(Schedule.Tick, physics ? [physics.tick] : [])
    .addSystems(Schedule.Update, [renderer.update])
    .addSystems(Schedule.PostUpdate, [renderer.postUpdate])
    .addSystems(Schedule.Exit, [domInput.exit, renderer.exit, ...(physics ? [physics.exit] : [])]);

  return { assets, input, renderer };
}
