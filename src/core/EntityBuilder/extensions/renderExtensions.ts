import type { AssetKey } from "@/core/Assets/AssetStore";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { Renderable } from "@/core/Renderer/renderComponents";

export type ModelRenderableOpts = {
  id?: number;
  flags?: {
    castShadow?: boolean;
    receiveShadow?: boolean;
    visible?: boolean;
    layer?: number;
  };
};

declare module "../EntityBuilder" {
  interface EntityBuilder {
    model(key: AssetKey, opts?: ModelRenderableOpts): EntityBuilder;
  }
}

EntityBuilder.extend({
  model(this: EntityBuilder, key: AssetKey, opts?: ModelRenderableOpts) {
    return this.with(Renderable, {
      id: opts?.id ?? 0,
      geometry: { kind: "model", key },
      material: { kind: "none" },
      flags: opts?.flags ?? { castShadow: true, receiveShadow: true },
    });
  },
});
