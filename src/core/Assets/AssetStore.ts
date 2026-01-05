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

type LoadedAsset = LoadedModel | THREE.Texture;

// Loader configuration for model loaders
export interface ModelLoaderConfig {
  loader: AssetLoader<LoadedModel>;
  extensions: string[];
}

// Loader configuration for texture loaders
export interface TextureLoaderConfig {
  loader: AssetLoader<THREE.Texture>;
  extensions: string[];
}

// Configuration options for AssetStore constructor
export interface AssetStoreConfig {
  modelLoaders?: { [name: string]: ModelLoaderConfig };
  textureLoaders?: { [name: string]: TextureLoaderConfig };
}

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

  // Loader management
  registerModelLoader(name: string, config: ModelLoaderConfig): void;
  registerTextureLoader(name: string, config: TextureLoaderConfig): void;
  getSupportedModelExtensions(): string[];
  getSupportedTextureExtensions(): string[];

  clear(): void;
}

export class AssetStore implements IAssetStore {
  private cache = new Map<string, Promise<LoadedAsset>>();
  private modelLoaders = new Map<string, ModelLoaderConfig>();
  private textureLoaders = new Map<string, TextureLoaderConfig>();

  constructor(config: AssetStoreConfig = {}) {
    // Register default loaders
    this.registerDefaultLoaders();

    // Add any additional loaders provided
    if (config.modelLoaders) {
      Object.entries(config.modelLoaders).forEach(([name, loaderConfig]) => {
        this.registerModelLoader(name, loaderConfig);
      });
    }

    if (config.textureLoaders) {
      Object.entries(config.textureLoaders).forEach(([name, loaderConfig]) => {
        this.registerTextureLoader(name, loaderConfig);
      });
    }
  }

  private registerDefaultLoaders(): void {
    this.registerModelLoader("gltf", {
      loader: createGltfLoader(),
      extensions: ["glb", "gltf"],
    });

    this.registerTextureLoader("texture", {
      loader: createTextureLoader(),
      extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"],
    });
  }

  registerModelLoader(name: string, config: ModelLoaderConfig): void {
    if (this.modelLoaders.has(name)) {
      console.warn(`Model loader '${name}' is being overridden`);
    }
    this.modelLoaders.set(name, config);
  }

  registerTextureLoader(name: string, config: TextureLoaderConfig): void {
    if (this.textureLoaders.has(name)) {
      console.warn(`Texture loader '${name}' is being overridden`);
    }
    this.textureLoaders.set(name, config);
  }

  getSupportedModelExtensions(): string[] {
    const extensions = new Set<string>();
    this.modelLoaders.forEach((config) => {
      config.extensions.forEach((ext) => extensions.add(ext));
    });
    return Array.from(extensions).sort();
  }

  getSupportedTextureExtensions(): string[] {
    const extensions = new Set<string>();
    this.textureLoaders.forEach((config) => {
      config.extensions.forEach((ext) => extensions.add(ext));
    });
    return Array.from(extensions).sort();
  }

  private getFileExtension(url: string): string {
    return url.split(".").pop()?.toLowerCase() || "";
  }

  private findModelLoaderByExtension(
    extension: string
  ): ModelLoaderConfig | null {
    for (const config of this.modelLoaders.values()) {
      if (config.extensions.includes(extension)) {
        return config;
      }
    }
    return null;
  }

  private findTextureLoaderByExtension(
    extension: string
  ): TextureLoaderConfig | null {
    for (const config of this.textureLoaders.values()) {
      if (config.extensions.includes(extension)) {
        return config;
      }
    }
    return null;
  }

  async loadModel(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);
    const loaderConfig = this.findModelLoaderByExtension(ext);

    if (!loaderConfig) {
      const supportedExts = this.getSupportedModelExtensions();
      throw new Error(
        `Unsupported model format: .${ext}. Supported extensions: ${supportedExts.join(
          ", "
        )}`
      );
    }

    const promise = loaderConfig.loader({ url });
    this.cache.set(key, promise);
    await promise;
  }

  async loadTexture(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);
    const loaderConfig = this.findTextureLoaderByExtension(ext);

    if (!loaderConfig) {
      const supportedExts = this.getSupportedTextureExtensions();
      throw new Error(
        `Unsupported texture format: .${ext}. Supported extensions: ${supportedExts.join(
          ", "
        )}`
      );
    }

    const promise = loaderConfig.loader({ url });
    this.cache.set(key, promise);
    await promise;
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
      return asset;
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
    return (
      typeof asset === "object" &&
      asset !== null &&
      "geometry" in asset &&
      "animations" in asset &&
      "materials" in asset
    );
  }

  clear(): void {
    this.cache.clear();
  }
}
