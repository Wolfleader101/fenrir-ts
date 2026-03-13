import type { Engine } from "./Engine.ts";
import type { IAssetStore } from "./Assets/AssetStore.ts";
import { AssetStore } from "./Assets/AssetStore.ts";
import { createObjLoader } from "./Assets/loaders/objLoader.ts";
import { createHdrTextureLoader } from "./Assets/loaders/hdrTextureLoader.ts";
import { createDomInputSystems } from "./InputSystem/DOMInputSystem.ts";
import { createInputStateSystem } from "./InputSystem/InputStateSystem.ts";
import { createThreeRendererSystem } from "./Renderer/ThreeRendererSystem.ts";
import { createPixiRendererSystem } from "./Renderer2D/PixiRendererSystem.ts";
import { createAnimationSystem } from "./Animation/index.ts";
import { createCameraSystem } from "./Camera/CameraSystem.ts";
import { createSkyboxSystem } from "./Skybox/SkyboxSystem.ts";
import { createPhysicsSystem } from "./Physics/PhysicsSystem.ts";
import { createStatsSystem } from "./Util/Stats.ts";
import { Schedule } from "./Scheduler.ts";
import type { ILogger } from "./ILogger.ts";

export type BootstrapConfig = {
  canvas: HTMLCanvasElement;
  enablePhysics?: boolean;
  enableAnimations?: boolean;
  enableStats?: boolean;
  enable2D?: boolean;
  statsParent?: HTMLElement;
  rendererType?: "webgl" | "webgpu";
  clearColor?: number;
};

export type BootstrapResult = {
  assets: IAssetStore;
  systems: {
    input: ReturnType<typeof createInputStateSystem>;
    renderer?: ReturnType<typeof createThreeRendererSystem>;
    renderer2D?: ReturnType<typeof createPixiRendererSystem>;
    camera: ReturnType<typeof createCameraSystem>;
    skybox: ReturnType<typeof createSkyboxSystem>;
    animations?: ReturnType<typeof createAnimationSystem>;
    physics?: ReturnType<typeof createPhysicsSystem>;
    stats?: ReturnType<typeof createStatsSystem>;
  };
};

/**
 * Bootstrap core engine systems with sensible defaults
 *
 * This creates and configures the essential systems needed for most games:
 * - Input handling
 * - Rendering (WebGL/WebGPU 3D or PixiJS 2D)
 * - Camera management
 * - Skybox rendering
 * - Optional: Physics, Animations, Performance stats
 */
export function bootstrapEngine(
  engine: Engine,
  logger: ILogger,
  config: BootstrapConfig,
): BootstrapResult {
  const {
    canvas,
    enablePhysics = false,
    enableAnimations = false,
    enableStats = false,
    enable2D = false,
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
  const domInput = createDomInputSystems({
    target: window,
    preventDefaults: true,
  });
  const input = createInputStateSystem();

  // Camera and Skybox
  const camera = createCameraSystem();
  const skybox = createSkyboxSystem({ assets });

  // Choose renderer based on config
  let renderer: ReturnType<typeof createThreeRendererSystem> | undefined;
  let renderer2D: ReturnType<typeof createPixiRendererSystem> | undefined;

  if (enable2D) {
    // Use 2D renderer (PixiJS)
    renderer2D = createPixiRendererSystem({
      logger,
      canvas,
      clearColor,
      assets,
    });
  } else {
    // Use 3D renderer (Three.js) - default
    renderer = createThreeRendererSystem({
      logger,
      canvas,
      clearColor,
      assets,
      cameraSystem: camera,
      skyboxSystem: skybox,
      rendererType,
    });
  }

  // Optional: Animation System (only for 3D)
  const animations =
    enableAnimations && renderer
      ? createAnimationSystem({
          assets,
          logger,
          renderer: renderer.renderer,
        })
      : undefined;

  // Optional: Physics System
  const physics = enablePhysics ? createPhysicsSystem() : undefined;

  // Optional: Stats System
  const stats = enableStats ? createStatsSystem(statsParent) : undefined;

  // Register systems with engine in correct order
  const initSystems = [
    domInput.init,
    ...(renderer ? [renderer.init] : []),
    ...(renderer2D ? [renderer2D.init] : []),
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
    ...(renderer ? [renderer.update] : []),
    ...(renderer2D ? [renderer2D.update] : []),
  ];

  const postUpdateSystems = [
    ...(renderer ? [renderer.postUpdate] : []),
    ...(renderer2D ? [renderer2D.postUpdate] : []),
    ...(stats ? [stats.postUpdate] : []),
  ];

  const exitSystems = [
    domInput.exit,
    ...(renderer ? [renderer.exit] : []),
    ...(renderer2D ? [renderer2D.exit] : []),
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
      renderer2D,
      camera,
      skybox,
      animations,
      physics,
      stats,
    },
  };
}
