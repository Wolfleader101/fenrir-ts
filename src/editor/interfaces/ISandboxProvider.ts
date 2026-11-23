import type { SandboxContext } from "@/editor/types";
import type { IAssetStore } from "@/core/Assets/AssetStore";

export interface ISandboxProvider {
  build(ctx: SandboxContext, assets: IAssetStore): Record<string, unknown>;
}
