import type { SystemCtx } from "../SystemCtx";
import { PixiRenderer } from "./PixiRenderer";
import type { PixiRendererOptions } from "./PixiRenderer";
import { Renderable2D } from "./render2DComponents";

export interface PixiRendererSystemOptions extends PixiRendererOptions {
  // Additional system-specific options can be added here
}

/**
 * Create a PixiJS renderer system that integrates with the ECS lifecycle
 */
export function createPixiRendererSystem(opts: PixiRendererSystemOptions) {
  const renderer = new PixiRenderer(opts);

  return {
    renderer,

    /**
     * Initialize the renderer and setup component signal handlers
     */
    init: async (ctx: SystemCtx) => {
      await renderer.init();

      // Setup signal handlers for component changes
      ctx.entities.signals.onAdd(Renderable2D, async (e, r) => {
        await renderer.upsertRenderable(ctx.entities, e, r);
      });

      ctx.entities.signals.onRemove(Renderable2D, (e, r) => {
        renderer.removeRenderable(e, r.id);
      });

      ctx.entities.signals.onReplace(Renderable2D, async (e, r) => {
        await renderer.upsertRenderable(ctx.entities, e, r);
      });

      ctx.logger.info("PixiRendererSystem initialized");
    },

    /**
     * Update transforms every frame
     */
    update: (ctx: SystemCtx) => {
      renderer.syncTransforms(ctx.entities);
    },

    /**
     * Render the scene after all updates
     */
    postUpdate: (ctx: SystemCtx) => {
      renderer.render();
    },

    /**
     * Cleanup on system exit
     */
    exit: async (ctx: SystemCtx) => {
      renderer.dispose();
      ctx.logger.info("PixiRendererSystem disposed");
    },
  };
}
