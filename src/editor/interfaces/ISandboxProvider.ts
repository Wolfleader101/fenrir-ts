import type { SystemCtx } from "@/core/SystemCtx";
import type { IAssetStore } from "@/core/Assets/AssetStore";

export interface ISandboxProvider {
  build(ctx: SystemCtx, assets: IAssetStore): Record<string, unknown>;
}
