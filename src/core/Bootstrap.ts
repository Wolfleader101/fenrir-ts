import type { Engine } from "./Engine.ts";
import { AssetStore } from "./Assets/AssetStore.ts";
import "./Assets/Assets3D.ts";
import { createObjLoader } from "./Assets/loaders/objLoader.ts";
import { createHdrTextureLoader } from "./Assets/loaders/hdrTextureLoader.ts";
import type { DomInputOptions } from "./InputSystem/DOMInputSystem.ts";
import { createDomInputSystems } from "./InputSystem/DOMInputSystem.ts";
import { createInputStateSystem } from "./InputSystem/InputStateSystem.ts";
import { createThreeRendererSystem } from "./Renderer/ThreeRendererSystem.ts";
import { createAnimationSystem } from "./Animation/index.ts";
import { createCameraSystem } from "./Camera/CameraSystem.ts";
import { createSkyboxSystem } from "./Skybox/SkyboxSystem.ts";
import { createStatsSystem } from "./Util/Stats.ts";
import { Schedule } from "./Scheduler.ts";
import type { ILogger } from "./ILogger.ts";
import type { AsyncSystemFn, SyncSystemFn } from "./SystemCtx.ts";

/**
 * The systems bootstrapEngine registers for physics. `createPhysicsSystem()` from
 * `fenrir-ts/physics` returns one. Typed here by shape so the 3D entry does not
 * import Jolt.
 */
export type BootstrapPhysicsSystem = {
  init: AsyncSystemFn;
  tick: SyncSystemFn;
  exit: AsyncSystemFn;
};

export type BootstrapConfig = {
  canvas: HTMLCanvasElement;
  /** Physics to register, for example `createPhysicsSystem()` from `fenrir-ts/physics`. */
  physics?: BootstrapPhysicsSystem;
  enableAnimations?: boolean;
  enableStats?: boolean;
  domInput?: DomInputOptions | false;
  statsParent?: HTMLElement;
  rendererType?: "webgl" | "webgpu";
  clearColor?: number;
};

export type BootstrapResult = {
  assets: AssetStore;
  systems: {
    input: ReturnType<typeof createInputStateSystem>;
    renderer: ReturnType<typeof createThreeRendererSystem>;
    camera: ReturnType<typeof createCameraSystem>;
    skybox: ReturnType<typeof createSkyboxSystem>;
    animations?: ReturnType<typeof createAnimationSystem>;
    physics?: BootstrapPhysicsSystem;
    stats?: ReturnType<typeof createStatsSystem>;
  };
};

/**
 * Bootstrap the 3D engine systems with sensible defaults
 *
 * This creates and configures the systems a 3D game needs:
 * - Input handling
 * - Rendering (WebGL/WebGPU through Three.js)
 * - Camera management
 * - Skybox rendering
 * - Optional: Physics, Animations, Performance stats
 *
 * A 2D game does not use this: it registers the systems from `fenrir-ts/2d` itself.
 */
export function bootstrapEngine(
  engine: Engine,
  logger: ILogger,
  config: BootstrapConfig,
): BootstrapResult {
  const {
    canvas,
    physics,
    enableAnimations = false,
    enableStats = false,
    rendererType = "webgpu",
    clearColor = 0x101010,
    statsParent = document.body,
  } = config;

  logger.info("🚀 Bootstrapping engine systems...");

  // Create AssetStore with enhanced loaders
  const assets = new AssetStore({
    modelLoaders: {
      obj: {
        loader: createObjLoader(),
        extensions: ["obj"],
      },
    },
    textureLoaders: {
      hdr: {
        loader: createHdrTextureLoader(),
        extensions: ["hdr", "exr"],
      },
    },
  });

  // Core Input Systems
  const domInput = config.domInput === false ? undefined : createDomInputSystems(config.domInput);
  const input = createInputStateSystem();

  // Camera and Skybox
  const camera = createCameraSystem();
  const skybox = createSkyboxSystem({ assets });

  // 3D renderer (Three.js)
  const renderer = createThreeRendererSystem({
    logger,
    canvas,
    clearColor,
    assets,
    cameraSystem: camera,
    skyboxSystem: skybox,
    rendererType,
  });

  // Optional: Animation System (only for 3D)
  const animations =
    enableAnimations
      ? createAnimationSystem({
          assets,
          logger,
          renderer: renderer.renderer,
        })
      : undefined;

  // Optional: Stats System
  const stats = enableStats ? createStatsSystem(statsParent) : undefined;

  // Register systems with engine in correct order
  const initSystems = [
    ...(domInput ? [domInput.init] : []),
    renderer.init,
    ...(animations ? [animations.init] : []),
    ...(physics ? [physics.init] : []),
    camera.init,
    skybox.init,
  ];

  const preUpdateSystems = [
    input.preUpdate,
    camera.preUpdate,
    skybox.preUpdate,
    ...(animations ? [animations.preUpdate] : []),
  ];

  const tickSystems = physics ? [physics.tick] : [];

  const updateSystems = [
    camera.update,
    renderer.update,
  ];

  const postUpdateSystems = [
    renderer.postUpdate,
    ...(stats ? [stats.postUpdate] : []),
  ];

  const exitSystems = [
    ...(domInput ? [domInput.exit] : []),
    renderer.exit,
    ...(animations ? [animations.exit] : []),
    ...(physics ? [physics.exit] : []),
    camera.exit,
    skybox.exit,
  ];

  engine
    .addSystems(Schedule.Init, initSystems)
    .addSystems(Schedule.PreUpdate, preUpdateSystems)
    .addSystems(Schedule.Tick, tickSystems)
    .addSystems(Schedule.Update, updateSystems)
    .addSystems(Schedule.PostUpdate, postUpdateSystems)
    .addSystems(Schedule.Exit, exitSystems);

  logger.info("✅ Core systems bootstrapped successfully");

  return {
    assets,
    systems: {
      input,
      renderer,
      camera,
      skybox,
      animations,
      physics,
      stats,
    },
  };
}
