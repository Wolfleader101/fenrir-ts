import { Assets, Texture } from "pixi.js";
import type { AssetLoader } from "../AssetLoader";

export function createPixiTextureLoader(): AssetLoader<Texture> {
  return async ({ url }) => {
    return await Assets.load<Texture>(url);
  };
}
