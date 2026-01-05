import { TextureLoader } from "three";
import type { AssetLoader } from "../AssetLoader";
import type * as THREE from "three";

export function createTextureLoader(opts?: {
  loader?: TextureLoader;
}): AssetLoader<THREE.Texture> {
  const loader = opts?.loader ?? new TextureLoader();

  return async ({ url }) => {
    return await loader.loadAsync(url);
  };
}
