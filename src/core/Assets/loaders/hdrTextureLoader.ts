import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import type { AssetLoader } from "../AssetLoader";

export function createHdrTextureLoader(opts?: {
  loader?: HDRLoader;
}): AssetLoader<THREE.Texture> {
  const loader = opts?.loader ?? new HDRLoader();

  return async ({ url }) => {
    const texture = await loader.loadAsync(url);

    // HDR textures are typically used for environment mapping
    texture.mapping = THREE.EquirectangularReflectionMapping;

    return texture;
  };
}
