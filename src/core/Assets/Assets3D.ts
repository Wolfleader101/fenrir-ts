// 3D models and textures in the asset store. Part of fenrir-ts/3d.
//
// Loading this module adds the "model" and "texture3d" kinds to AssetStore: the
// default glTF and texture loaders, the `modelLoaders` and `textureLoaders`
// options and the typed methods below.
import type * as THREE from "three";
import { AssetStore, type AssetKey, type AssetKind, type LoaderConfig } from "./AssetStore";
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

  interface AssetStoreConfig {
    modelLoaders?: { [name: string]: ModelLoaderConfig };
    textureLoaders?: { [name: string]: TextureLoaderConfig };
  }

  interface IAssetStore {
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

  interface AssetStore {
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

async function getModel(store: AssetStore, key: AssetKey): Promise<LoadedModel> {
  const asset = await store.get(key);
  if (isModel(asset)) return asset;
  throw new Error(`Asset "${key}" is not a model`);
}

const methods: Pick<
  AssetStore,
  | "loadModel"
  | "loadTexture"
  | "getGeometry"
  | "getAnimations"
  | "getMaterials"
  | "getTexture"
  | "registerModelLoader"
  | "registerTextureLoader"
  | "getSupportedModelExtensions"
  | "getSupportedTextureExtensions"
> = {
  registerModelLoader(this: AssetStore, name, config) {
    this.registerLoader(MODEL, name, config, "model");
  },

  registerTextureLoader(this: AssetStore, name, config) {
    this.registerLoader(TEXTURE, name, config, "texture");
  },

  getSupportedModelExtensions(this: AssetStore) {
    return this.getSupportedExtensions(MODEL);
  },

  getSupportedTextureExtensions(this: AssetStore) {
    return this.getSupportedExtensions(TEXTURE);
  },

  async loadModel(this: AssetStore, key, url) {
    const loader = this.resolveLoader(MODEL, url, "model");
    const promise = loader({ url });
    this.setAsset(key, MODEL, promise);
    await promise;
  },

  async loadTexture(this: AssetStore, key, url) {
    const loader = this.resolveLoader(TEXTURE, url, "texture");
    const promise = loader({ url });
    this.setAsset(key, TEXTURE, promise);
    await promise;
  },

  async getGeometry(this: AssetStore, key) {
    return (await getModel(this, key)).geometry;
  },

  async getAnimations(this: AssetStore, key) {
    return [...(await getModel(this, key)).animations]; // Return copy of array
  },

  async getMaterials(this: AssetStore, key) {
    return [...(await getModel(this, key)).materials]; // Return copy of array
  },

  getTexture(this: AssetStore, key) {
    return this.get(key, TEXTURE, "texture");
  },
};

Object.assign(AssetStore.prototype, methods);

AssetStore.addInstaller((store, config) => {
  store.registerModelLoader("gltf", {
    loader: createGltfLoader(),
    extensions: ["glb", "gltf"],
  });
  store.registerTextureLoader("texture", {
    loader: createTextureLoader(),
    extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"],
  });
  for (const [name, loaderConfig] of Object.entries(config.modelLoaders ?? {})) {
    store.registerModelLoader(name, loaderConfig);
  }
  for (const [name, loaderConfig] of Object.entries(config.textureLoaders ?? {})) {
    store.registerTextureLoader(name, loaderConfig);
  }
});
