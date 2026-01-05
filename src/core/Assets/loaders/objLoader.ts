import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { AssetLoader } from "../AssetLoader";
import type { LoadedModel } from "../AssetStore";

export function createObjLoader(opts?: {
  loader?: OBJLoader;
}): AssetLoader<LoadedModel> {
  const loader = opts?.loader ?? new OBJLoader();

  return async ({ url }) => {
    const object = await loader.loadAsync(url);

    // Extract materials from the loaded object
    const materials: THREE.Material[] = [];
    object.traverse((child) => {
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
      geometry: object, // The entire loaded object
      animations: [], // OBJ files don't contain animations
      materials: [...new Set(materials)], // Remove duplicates
    };
  };
}
