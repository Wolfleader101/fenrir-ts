// 3D models and textures in the asset store. Part of fenrir-ts/3d.
//
// Adds the "model" and "texture3d" kinds to AssetKinds (types only) and AssetStore3D, the
// store with the default glTF and texture loaders and the typed methods. Nothing here runs at
// import or patches AssetStore.
import type * as THREE from "three";
import { AssetStore, type AssetKey, type AssetKind, type IAssetStore, type LoaderConfig } from "./AssetStore";
import { createGltfLoader } from "./loaders/gltfLoader";
import { createTextureLoader } from "./loaders/textureLoader";

export type LoadedModel = {
  geometry: THREE.Object3D;
  animations: THREE.AnimationClip[];
  materials: THREE.Material[];
};

// Loader configuration for model loaders
export type ModelLoaderConfig = LoaderConfig<LoadedModel>;

// Loader configuration for texture loaders
export type TextureLoaderConfig = LoaderConfig<THREE.Texture>;

declare module "./AssetStore" {
  interface AssetKinds {
    model: LoadedModel;
    texture3d: THREE.Texture;
  }
}

/** Options for `new AssetStore3D()`: loaders added after the default glTF and texture loaders. */
export interface AssetStore3DOptions {
  modelLoaders?: { [name: string]: ModelLoaderConfig };
  textureLoaders?: { [name: string]: TextureLoaderConfig };
}

/** The asset store as the 3D renderer, camera, skybox and animation systems see it. */
export interface IAssetStore3D extends IAssetStore {
  loadModel(key: AssetKey, url: string): Promise<void>;
  loadTexture(key: AssetKey, url: string): Promise<void>;
  getGeometry(key: AssetKey): Promise<THREE.Object3D>;
  getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
  getMaterials(key: AssetKey): Promise<THREE.Material[]>;
  getTexture(key: AssetKey): Promise<THREE.Texture>;
  registerModelLoader(name: string, config: ModelLoaderConfig): void;
  registerTextureLoader(name: string, config: TextureLoaderConfig): void;
  getSupportedModelExtensions(): string[];
  getSupportedTextureExtensions(): string[];
}

const MODEL = "model" satisfies AssetKind;
const TEXTURE = "texture3d" satisfies AssetKind;

function isModel(asset: unknown): asset is LoadedModel {
  return (
    typeof asset === "object" &&
    asset !== null &&
    "geometry" in asset &&
    "animations" in asset &&
    "materials" in asset
  );
}

/**
 * An asset store with the 3D kinds: the default glTF model loader and texture loader, then the
 * loaders in `options`, are registered when it is constructed. `bootstrapEngine` builds one.
 * A subclass rather than methods added to `AssetStore`, so a 2D or core game ships none of it.
 */
export class AssetStore3D extends AssetStore implements IAssetStore3D {
  constructor(options: AssetStore3DOptions = {}) {
    super();
    this.registerModelLoader("gltf", {
      loader: createGltfLoader(),
      extensions: ["glb", "gltf"],
    });
    this.registerTextureLoader("texture", {
      loader: createTextureLoader(),
      extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"],
    });
    for (const [name, loaderConfig] of Object.entries(options.modelLoaders ?? {})) {
      this.registerModelLoader(name, loaderConfig);
    }
    for (const [name, loaderConfig] of Object.entries(options.textureLoaders ?? {})) {
      this.registerTextureLoader(name, loaderConfig);
    }
  }

  registerModelLoader(name: string, config: ModelLoaderConfig): void {
    this.registerLoader(MODEL, name, config, "model");
  }

  registerTextureLoader(name: string, config: TextureLoaderConfig): void {
    this.registerLoader(TEXTURE, name, config, "texture");
  }

  getSupportedModelExtensions(): string[] {
    return this.getSupportedExtensions(MODEL);
  }

  getSupportedTextureExtensions(): string[] {
    return this.getSupportedExtensions(TEXTURE);
  }

  async loadModel(key: AssetKey, url: string): Promise<void> {
    const loader = this.resolveLoader(MODEL, url, "model");
    const promise = loader({ url });
    this.setAsset(key, MODEL, promise);
    await promise;
  }

  async loadTexture(key: AssetKey, url: string): Promise<void> {
    const loader = this.resolveLoader(TEXTURE, url, "texture");
    const promise = loader({ url });
    this.setAsset(key, TEXTURE, promise);
    await promise;
  }

  async getGeometry(key: AssetKey): Promise<THREE.Object3D> {
    return (await this.getModel(key)).geometry;
  }

  async getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]> {
    return [...(await this.getModel(key)).animations]; // Return copy of array
  }

  async getMaterials(key: AssetKey): Promise<THREE.Material[]> {
    return [...(await this.getModel(key)).materials]; // Return copy of array
  }

  getTexture(key: AssetKey): Promise<THREE.Texture> {
    return this.get(key, TEXTURE, "texture");
  }

  private async getModel(key: AssetKey): Promise<LoadedModel> {
    const asset = await this.get(key);
    if (isModel(asset)) return asset;
    throw new Error(`Asset "${key}" is not a model`);
  }
}
