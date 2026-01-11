import type { IAssetStore } from "../Assets/AssetStore";
import type { ILogger } from "../ILogger";
import type { SyncSystemFn, AsyncSystemFn } from "../SystemCtx";
import { Renderable } from "./renderComponents";
import { ThreeRenderer, type RendererType } from "./ThreeRenderer";
import type { CameraInstance } from "../Camera/CameraComponents";
import type { createCameraSystem } from "../Camera/CameraSystem";
import type { createSkyboxSystem } from "../Skybox/SkyboxSystem";

type CameraSystemInstance = ReturnType<typeof createCameraSystem>;
type SkyboxSystemInstance = ReturnType<typeof createSkyboxSystem>;

export function createThreeRendererSystem(opts: {
  logger: ILogger;
  canvas?: HTMLCanvasElement;
  clearColor?: number;
  assets: IAssetStore;
  cameraSystem: CameraSystemInstance | undefined;
  skyboxSystem: SkyboxSystemInstance | undefined;
  rendererType: RendererType | undefined;
}) {
  let three = new ThreeRenderer({
    canvas: opts.canvas,
    logger: opts.logger,
    clearColor: opts.clearColor,
    assets: opts.assets,
    rendererType: opts.rendererType,
  });

  const { cameraSystem, skyboxSystem } = opts;

  const init: AsyncSystemFn = async (ctx) => {
    // Initialize renderer (required for WebGPU)
    await three.init();
    opts.logger.info(
      `✅ ${three.rendererType.toUpperCase()} renderer initialized`
    );
    ctx.entities.signals.onAdd(Renderable, async (e, r) => {
      await three.upsertRenderable(ctx.entities, e, r);
    });

    // Remove meshes when Renderable is removed (or entity destroyed triggers component removals)
    ctx.entities.signals.onRemove(Renderable, (e, r) => {
      three.removeRenderable(e, r.id);
    });

    // Optional: handle replace (material/geometry changes)
    ctx.entities.signals.onReplace(Renderable, async (e, r) => {
      await three.upsertRenderable(ctx.entities, e, r);
    });

    // If entities already exist with Renderable before init, hydrate:
    ctx.entities.each([Renderable] as const, async (e, r) => {
      await three.upsertRenderable(ctx.entities, e, r);
    });

    // Basic resize handling
    const onResize = () => {
      if (!three) return;
      three.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // store cleanup in closure
    cleanupFns.push(() => window.removeEventListener("resize", onResize));
  };

  const update: SyncSystemFn = (ctx) => {
    if (!three) return;

    // WorldTransform should already be computed in PreUpdate by your propagation system
    three.syncTransforms(ctx.entities);
  };

  const postUpdate: SyncSystemFn = (ctx) => {
    if (!three) return;

    // Check if we have camera and skybox systems for ECS rendering
    if (cameraSystem && skyboxSystem) {
      // Get cameras sorted by priority
      const cameras = cameraSystem.getCamerasSortedByPriority(ctx.entities);

      // Get skybox for current scene
      const skyboxInstance = skyboxSystem.getSkyboxInstance(ctx.scene);

      // Filter to get camera instances
      const cameraInstances: Array<[number, CameraInstance]> = [];
      for (const [entity, _camera, instance] of cameras) {
        cameraInstances.push([entity, instance]);
      }

      if (cameraInstances.length > 0) {
        // Render with ECS cameras
        three.renderWithCameras(cameraInstances, ctx.scene, skyboxInstance);
      } else {
        // Fallback to legacy rendering if no ECS cameras
        three.render();
      }
    } else {
      // Legacy rendering without camera/skybox systems
      three.render();
    }
  };

  const cleanupFns: Array<() => void> = [];

  const exit: SyncSystemFn = () => {
    for (const fn of cleanupFns) fn();
    cleanupFns.length = 0;
  };

  return { init, update, postUpdate, exit, renderer: three } as const;
}
