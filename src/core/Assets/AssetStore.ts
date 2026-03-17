import * as THREE from "three";
import type { Texture as PixiTexture } from "pixi.js";
import type { AssetLoader } from "./AssetLoader";
import { createGltfLoader } from "./loaders/gltfLoader";
import { createPixiTextureLoader } from "./loaders/pixiTextureLoader";
import { createTextureLoader } from "./loaders/textureLoader";

export type AssetKey = string & { __assetKey?: true };
export const assetKey = (k: string) => k as AssetKey;

export type LoadedModel = {
  geometry: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: THREE.Material[];
};

type LoadedAsset = LoadedModel | THREE.Texture | PixiTexture;
type AssetKind = "model" | "texture3d" | "texture2d";

type LoaderConfig<T> = {
  loader: AssetLoader<T>;
  extensions: string[];
};

// Loader configuration for model loaders
export type ModelLoaderConfig = LoaderConfig<LoadedModel>;

// Loader configuration for texture loaders
export type TextureLoaderConfig = LoaderConfig<THREE.Texture>;
export type PixiTextureLoaderConfig = LoaderConfig<PixiTexture>;

// Configuration options for AssetStore constructor
export interface AssetStoreConfig {
  modelLoaders?: { [name: string]: ModelLoaderConfig };
  textureLoaders?: { [name: string]: TextureLoaderConfig };
  texture2DLoaders?: { [name: string]: PixiTextureLoaderConfig };
}

export interface IAssetStore {
  // Intuitive loading methods
  loadModel(key: AssetKey, url: string): Promise<void>;
  loadTexture(key: AssetKey, url: string): Promise<void>;
  loadTexture2D(key: AssetKey, url: string): Promise<void>;

  // Typed getters for different asset parts
  getGeometry(key: AssetKey): Promise<THREE.Object3D>;
  getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
  getMaterials(key: AssetKey): Promise<THREE.Material[]>;
  getTexture(key: AssetKey): Promise<THREE.Texture>;
  getTexture2D(key: AssetKey): Promise<PixiTexture>;

  // Generic getter (for advanced use)
  get(key: AssetKey): Promise<LoadedAsset>;

  // Loader management
  registerModelLoader(name: string, config: ModelLoaderConfig): void;
  registerTextureLoader(name: string, config: TextureLoaderConfig): void;
  registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
  getSupportedModelExtensions(): string[];
  getSupportedTextureExtensions(): string[];
  getSupportedTexture2DExtensions(): string[];

  clear(): void;
}

export class AssetStore implements IAssetStore {
  private cache = new Map<string, Promise<LoadedAsset>>();
  private assetKinds = new Map<string, AssetKind>();
  private modelLoaders = new Map<string, ModelLoaderConfig>();
  private textureLoaders = new Map<string, TextureLoaderConfig>();
  private texture2DLoaders = new Map<string, PixiTextureLoaderConfig>();

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

    if (config.texture2DLoaders) {
      Object.entries(config.texture2DLoaders).forEach(
        ([name, loaderConfig]) => {
          this.registerTexture2DLoader(name, loaderConfig);
        },
      );
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

    this.registerTexture2DLoader("pixi-texture", {
      loader: createPixiTextureLoader(),
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

  registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void {
    if (this.texture2DLoaders.has(name)) {
      console.warn(`2D texture loader '${name}' is being overridden`);
    }
    this.texture2DLoaders.set(name, config);
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

  getSupportedTexture2DExtensions(): string[] {
    const extensions = new Set<string>();
    this.texture2DLoaders.forEach((config) => {
      config.extensions.forEach((ext) => extensions.add(ext));
    });
    return Array.from(extensions).sort();
  }

  private getFileExtension(url: string): string {
    // Handle data URLs (e.g. data:image/png;base64,...)
    if (url.startsWith("data:")) {
      // data:<mimeType>[;...],...
      const mime = url.slice(
        5,
        url.indexOf(";") === -1 ? url.indexOf(",") : url.indexOf(";"),
      );
      // mime like "image/png"
      const subtype = mime.split("/")[1]?.toLowerCase();
      // map common image subtypes to your extension list
      if (!subtype) return "";
      if (subtype === "jpeg") return "jpg";
      return subtype; // png, webp, gif, bmp, etc.
    }

    // Strip query + hash
    const clean = url.split("#")[0]!.split("?")[0]!;

    // If it’s a path with no dot, no extension
    const lastDot = clean.lastIndexOf(".");
    if (lastDot === -1) return "";

    return clean.slice(lastDot + 1).toLowerCase();
  }

  private findModelLoaderByExtension(
    extension: string,
  ): ModelLoaderConfig | null {
    for (const config of this.modelLoaders.values()) {
      if (config.extensions.includes(extension)) {
        return config;
      }
    }
    return null;
  }

  private findTextureLoaderByExtension(
    extension: string,
  ): TextureLoaderConfig | null {
    for (const config of this.textureLoaders.values()) {
      if (config.extensions.includes(extension)) {
        return config;
      }
    }
    return null;
  }

  private findTexture2DLoaderByExtension(
    extension: string,
  ): PixiTextureLoaderConfig | null {
    for (const config of this.texture2DLoaders.values()) {
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
          ", ",
        )}`,
      );
    }

    const promise = loaderConfig.loader({ url });
    this.cache.set(key, promise);
    this.assetKinds.set(key, "model");
    await promise;
  }

  async loadTexture(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);
    const loaderConfig = this.findTextureLoaderByExtension(ext);

    if (!loaderConfig) {
      const supportedExts = this.getSupportedTextureExtensions();
      throw new Error(
        `Unsupported texture format: .${ext}. Supported extensions: ${supportedExts.join(
          ", ",
        )}`,
      );
    }

    const promise = loaderConfig.loader({ url });
    this.cache.set(key, promise);
    this.assetKinds.set(key, "texture3d");
    await promise;
  }

  async loadTexture2D(key: AssetKey, url: string): Promise<void> {
    const ext = this.getFileExtension(url);
    const loaderConfig = this.findTexture2DLoaderByExtension(ext);

    if (!loaderConfig) {
      const supportedExts = this.getSupportedTexture2DExtensions();
      throw new Error(
        `Unsupported 2D texture format: .${ext}. Supported extensions: ${supportedExts.join(
          ", ",
        )}`,
      );
    }

    const promise = loaderConfig.loader({ url });
    this.cache.set(key, promise);
    this.assetKinds.set(key, "texture2d");
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
    if (this.assetKinds.get(key) === "texture3d") {
      return asset as THREE.Texture;
    }
    throw new Error(`Asset "${key}" is not a texture`);
  }

  async getTexture2D(key: AssetKey): Promise<PixiTexture> {
    const asset = await this.get(key);
    if (this.assetKinds.get(key) === "texture2d") {
      return asset as PixiTexture;
    }
    throw new Error(`Asset "${key}" is not a 2D texture`);
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
    this.assetKinds.clear();
  }
}
