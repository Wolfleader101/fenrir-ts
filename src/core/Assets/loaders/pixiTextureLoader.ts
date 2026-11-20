import { Assets, Texture } from "pixi.js";
import type { AssetLoader } from "../AssetLoader";

export function createPixiTextureLoader(): AssetLoader<Texture> {
  return async ({ url }) => {
    return await Assets.load<Texture>(url);
  };
}

/** Destroys a texture `createPixiTextureLoader` loaded, through Pixi's own cache, which owns it. */
export const unloadPixiTexture = (_texture: Texture, { url }: { url: string }): Promise<void> => Assets.unload(url);
