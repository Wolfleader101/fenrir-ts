import { nameEngineSystems } from "../SystemName";
import type { Entity, EntityList } from "../ECS";
import type { SystemCtx } from "../SystemCtx";
import { PixiRenderer } from "./PixiRenderer";
import type { PixiRendererOptions } from "./PixiRenderer";
import { Renderable2D } from "./render2DComponents";

export interface PixiRendererSystemOptions extends PixiRendererOptions {}

export function createPixiRendererSystem(opts: PixiRendererSystemOptions) {
  const renderer = new PixiRenderer(opts);
  let active: EntityList | undefined;
  let unsubscribe: Array<() => void> = [];

  function bindScene(entities: EntityList): void {
    if (active === entities) return;
    for (const off of unsubscribe) off();
    renderer.clearRenderables();
    active = entities;
    const ids = new Map<Entity, number>();

    const upsert = (entity: Entity, renderable: Renderable2D) => {
      const previous = ids.get(entity);
      if (previous !== undefined && previous !== renderable.id) renderer.removeRenderable(entity, previous);
      ids.set(entity, renderable.id);
      void renderer.upsertRenderable(entities, entity, renderable).catch((error: unknown) => {
        opts.logger.error("Unable to update Pixi renderable", { entity, error });
      });
    };

    unsubscribe = [
      entities.signals.onAdd(Renderable2D, upsert),
      entities.signals.onReplace(Renderable2D, upsert),
      entities.signals.onRemove(Renderable2D, (entity, renderable) => {
        ids.delete(entity);
        renderer.removeRenderable(entity, renderable.id);
      }),
    ];
    entities.each([Renderable2D], upsert);
  }

  return nameEngineSystems("pixi", {
    renderer,
    init: async (ctx: SystemCtx) => {
      await renderer.init();
      bindScene(ctx.entities);
      ctx.logger.info("PixiRendererSystem initialized");
    },
    update: (ctx: SystemCtx) => {
      bindScene(ctx.entities);
      renderer.syncTransforms(ctx.entities);
    },
    postUpdate: () => renderer.render(),
    exit: (ctx: SystemCtx) => {
      for (const off of unsubscribe) off();
      unsubscribe = [];
      active = undefined;
      renderer.dispose();
      ctx.logger.info("PixiRendererSystem disposed");
    },
  });
}
