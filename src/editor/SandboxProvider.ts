import type { SystemCtx } from "@/core/SystemCtx";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import type { ISandboxProvider } from "./interfaces";
import { Vector3, Quaternion, Color } from "three";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { SkyboxUtils } from "@/core/Skybox";

export interface SandboxPlugin {
  readonly name: string;
  provide(ctx: SystemCtx, assets: IAssetStore): Record<string, unknown>;
}

export class SandboxProvider implements ISandboxProvider {
  private readonly plugins: SandboxPlugin[] = [];

  register(plugin: SandboxPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  build(ctx: SystemCtx, assets: IAssetStore): Record<string, unknown> {
    let sandbox: Record<string, unknown> = {};

    for (const plugin of this.plugins) {
      const provided = plugin.provide(ctx, assets);
      sandbox = { ...sandbox, ...provided };
    }

    return sandbox;
  }
}

// Built-in plugins
export const ThreeJsPlugin: SandboxPlugin = {
  name: "threejs",
  provide: () => ({
    Vector3,
    Quaternion,
    Color,
  }),
};

export const EngineApisPlugin: SandboxPlugin = {
  name: "engine-apis",
  provide: (ctx, assets) => ({
    EntityBuilder,
    SkyboxUtils,
    // TODO: expose more engine APIs as needed
    entities: ctx.entities,
    scene: ctx.scene,
    time: ctx.time,
    logger: ctx.logger,
    assets,
  }),
};

export const UtilitiesPlugin: SandboxPlugin = {
  name: "utilities",
  provide: () => ({
    console,
    Math,
  }),
};
