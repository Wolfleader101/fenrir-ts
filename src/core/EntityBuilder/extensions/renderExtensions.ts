import type { AssetKey } from "@/core/Assets/AssetStore";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import {
  Renderable,
  type MaterialDesc,
  type RenderFlags,
} from "@/core/Renderer/renderComponents";

export type ModelRenderableOpts = {
  id?: number;
  flags?: RenderFlags;
};

export type PrimitiveRenderableOpts = {
  id?: number;
  material?: MaterialDesc;
  flags?: RenderFlags;
};

declare module "../EntityBuilder" {
  interface EntityBuilder {
    model(key: AssetKey, opts?: ModelRenderableOpts): EntityBuilder;
    renderBox(
      size?: [number, number, number],
      opts?: PrimitiveRenderableOpts
    ): EntityBuilder;
    renderSphere(
      radius?: number,
      widthSeg?: number,
      heightSeg?: number,
      opts?: PrimitiveRenderableOpts
    ): EntityBuilder;
    renderPlane(
      size?: [number, number],
      opts?: PrimitiveRenderableOpts
    ): EntityBuilder;
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

  renderBox(
    this: EntityBuilder,
    size: [number, number, number] = [1, 1, 1],
    opts?: PrimitiveRenderableOpts
  ) {
    return this.with(Renderable, {
      id: opts?.id ?? 0,
      geometry: { kind: "box", size },
      material: opts?.material ?? { kind: "standard", color: 0x888888 },
      flags: opts?.flags ?? {
        castShadow: true,
        receiveShadow: true,
        visible: true,
      },
    });
  },

  renderSphere(
    this: EntityBuilder,
    radius: number = 1,
    widthSeg: number = 32,
    heightSeg: number = 16,
    opts?: PrimitiveRenderableOpts
  ) {
    return this.with(Renderable, {
      id: opts?.id ?? 0,
      geometry: { kind: "sphere", radius, widthSeg, heightSeg },
      material: opts?.material ?? { kind: "standard", color: 0x888888 },
      flags: opts?.flags ?? {
        castShadow: true,
        receiveShadow: true,
        visible: true,
      },
    });
  },

  renderPlane(
    this: EntityBuilder,
    size: [number, number] = [1, 1],
    opts?: PrimitiveRenderableOpts
  ) {
    return this.with(Renderable, {
      id: opts?.id ?? 0,
      geometry: { kind: "plane", size },
      material: opts?.material ?? { kind: "standard", color: 0x888888 },
      flags: opts?.flags ?? {
        castShadow: false,
        receiveShadow: true,
        visible: true,
      },
    });
  },
});
