import * as THREE from "three";
import type { AssetLoader } from "./AssetLoader";
import { createGltfLoader } from "./loaders/gltfLoader";
import { createTextureLoader } from "./loaders/textureLoader";

export type AssetKey = string & { __assetKey?: true };
export const assetKey = (k: string) => k as AssetKey;

export type LoadedModel = {
  geometry: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: THREE.Material[];
};

type LoadedAsset = LoadedModel | THREE.Texture | THREE.Material;

export interface IAssetStore {
  // Intuitive loading methods
  loadModel(key: AssetKey, url: string): Promise<void>;
  loadTexture(key: AssetKey, url: string): Promise<void>;

  // Typed getters for different asset parts
  getGeometry(key: AssetKey): Promise<THREE.Object3D>;
  getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
  getMaterials(key: AssetKey): Promise<THREE.Material[]>;
  getTexture(key: AssetKey): Promise<THREE.Texture>;

  // Generic getter (for advanced use)
  get(key: AssetKey): Promise<LoadedAsset>;

  clear(): void;
}

export class AssetStore implements IAssetStore {
  private cache = new Map<string, Promise<LoadedAsset>>();
  private loaders: {
    gltf: AssetLoader<LoadedModel>;
    texture: AssetLoader<THREE.Texture>;
  };

  constructor() {
    this.loaders = {
      gltf: createGltfLoader(),
      texture: createTextureLoader(),
    };
  }

  private getFileExtension(url: string): string {
    return url.split(".").pop()?.toLowerCase() || "";
  }

  async loadModel(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);

    if (ext !== "glb" && ext !== "gltf") {
      throw new Error(
        `Unsupported model format: .${ext}. Supported: .glb, .gltf`
      );
    }

    const promise = this.loadGltfModel(url);
    this.cache.set(key, promise);
    await promise;
  }

  async loadTexture(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);

    if (!["jpg", "jpeg", "png", "webp", "bmp", "gif"].includes(ext)) {
      throw new Error(`Unsupported texture format: .${ext}`);
    }

    const promise = this.loaders.texture({ url });
    this.cache.set(key, promise);
    await promise;
  }

  private async loadGltfModel(url: string): Promise<LoadedModel> {
    return await this.loaders.gltf({ url });
  }

  async getGeometry(key: AssetKey): Promise<THREE.Object3D> {
    const asset = await this.get(key);
    if (this.isModel(asset)) {
      return asset.geometry;
    }
    throw new Error(`Asset "${key}" is not a model`);
  }

  async getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]> {
    const asset = await this.get(key);
    if (this.isModel(asset)) {
      return [...asset.animations]; // Return copy of array
    }
    throw new Error(`Asset "${key}" is not a model`);
  }

  async getMaterials(key: AssetKey): Promise<THREE.Material[]> {
    const asset = await this.get(key);
    if (this.isModel(asset)) {
      return [...asset.materials]; // Return copy of array
    }
    throw new Error(`Asset "${key}" is not a model`);
  }

  async getTexture(key: AssetKey): Promise<THREE.Texture> {
    const asset = await this.get(key);
    if (!this.isModel(asset)) {
      return asset as THREE.Texture;
    }
    throw new Error(`Asset "${key}" is not a texture`);
  }

  async get(key: AssetKey): Promise<LoadedAsset> {
    const promise = this.cache.get(key);
    if (!promise) {
      throw new Error(`Asset not loaded: ${key}`);
    }
    return await promise;
  }

  private isModel(asset: LoadedAsset): asset is LoadedModel {
    return typeof asset === "object" && "gltf" in asset;
  }

  clear(): void {
    this.cache.clear();
  }
}
