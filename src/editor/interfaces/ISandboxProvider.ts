import type { SandboxContext } from "@/editor/types";
import type { IAssetStore3D } from "@/core/Assets/Assets3D";

export interface ISandboxProvider {
  build(ctx: SandboxContext, assets: IAssetStore3D): Record<string, unknown>;
}
