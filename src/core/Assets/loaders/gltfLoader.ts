import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetLoader } from "../AssetLoader";
import type { LoadedModel } from "../AssetStore";

export function createGltfLoader(opts?: {
  loader?: GLTFLoader;
}): AssetLoader<LoadedModel> {
  const loader = opts?.loader ?? new GLTFLoader();

  return async ({ url }) => {
    const gltf = await loader.loadAsync(url);

    const materials: THREE.Material[] = [];
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material;
        if (Array.isArray(material)) {
          materials.push(...material);
        } else {
          materials.push(material);
        }
      }
    });

    return {
      geometry: gltf.scene,
      animations: gltf.animations,
      materials: [...new Set(materials)], // Remove duplicates
    };
  };
}
