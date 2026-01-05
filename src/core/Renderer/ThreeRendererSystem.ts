import type { IAssetStore } from "../Assets/AssetStore";
import type { ILogger } from "../ILogger";
import type { SystemFn } from "../SystemCtx";
import { Renderable } from "./renderComponents";
import { ThreeRenderer } from "./ThreeRenderer";

export function createThreeRendererSystem(opts: {
  logger: ILogger;
  canvas?: HTMLCanvasElement;
  clearColor?: number;
  assets: IAssetStore;
}) {
  let three = new ThreeRenderer({
    canvas: opts.canvas,
    logger: opts.logger,
    clearColor: opts.clearColor,
    assets: opts.assets,
  });

  const init: SystemFn = (ctx) => {
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

  const update: SystemFn = (ctx) => {
    if (!three) return;

    // WorldTransform should already be computed in PreUpdate by your propagation system
    three.syncTransforms(ctx.entities);
  };

  const postUpdate: SystemFn = () => {
    if (!three) return;
    three.render();
  };

  const cleanupFns: Array<() => void> = [];

  const exit: SystemFn = () => {
    for (const fn of cleanupFns) fn();
    cleanupFns.length = 0;
  };

  return { init, update, postUpdate, exit, renderer: three } as const;
}
