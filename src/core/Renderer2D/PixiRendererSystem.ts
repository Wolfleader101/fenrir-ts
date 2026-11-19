import { nameEngineSystems } from "../SystemName";
import type { Entity, EntityList } from "../ECS";
import type { SystemCtx } from "../SystemCtx";
import { PixiRenderer } from "./PixiRenderer";
import type { PixiRendererOptions } from "./PixiRenderer";
import { PixiNode } from "./PixiNode";
import { Renderable2D } from "./render2DComponents";

const RENDERABLES = [Renderable2D] as const;
const NODES = [PixiNode] as const;

export interface PixiRendererSystemOptions extends PixiRendererOptions {}

export function createPixiRendererSystem(opts: PixiRendererSystemOptions) {
  const renderer = new PixiRenderer(opts);
  let active: EntityList | undefined;
  let unsubscribe: Array<() => void> = [];

  function unbind(): void {
    for (const off of unsubscribe) off();
    unsubscribe = [];
  }

  function bindScene(entities: EntityList): void {
    if (active === entities) return;
    unbind();
    // Another scene's nodes stay on its entities, alive, until that scene is active again.
    renderer.unmountNodes();
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
    const attach = (entity: Entity, node: PixiNode) => renderer.attachNode(entities, entity, node);

    unsubscribe = [
      entities.signals.onAdd(Renderable2D, upsert),
      entities.signals.onReplace(Renderable2D, upsert),
      entities.signals.onRemove(Renderable2D, (entity, renderable) => {
        ids.delete(entity);
        renderer.removeRenderable(entity, renderable.id);
      }),
      entities.signals.onAdd(PixiNode, attach),
      entities.signals.onReplace(PixiNode, attach),
      entities.signals.onRemove(PixiNode, (entity, node) => renderer.detachNode(entity, node)),
    ];
    entities.each(RENDERABLES, upsert);
    entities.each(NODES, attach);
  }

  return nameEngineSystems("pixi", {
    renderer,
    init: async (ctx: SystemCtx) => {
      await renderer.init();
      bindScene(ctx.entities);
      ctx.logger.info("PixiRendererSystem initialized");
    },
    // Syncs after every Update system has run, then renders.
    postUpdate: (ctx: SystemCtx) => {
      bindScene(ctx.entities);
      renderer.syncTransforms(ctx.entities);
      renderer.render();
    },
    exit: (ctx: SystemCtx) => {
      unbind();
      renderer.releaseNodes(active);
      active = undefined;
      renderer.dispose();
      ctx.logger.info("PixiRendererSystem disposed");
    },
  });
}
