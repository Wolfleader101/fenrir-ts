import type { AssetLoader } from "./AssetLoader";

export type AssetKey = string & { __assetKey?: true };
export const assetKey = (k: string) => k as AssetKey;

/** A loader and the file extensions it handles. */
export type LoaderConfig<T> = {
  loader: AssetLoader<T>;
  extensions: string[];
};

/**
 * Constructor options. Empty in core: `fenrir-ts/2d` adds `texture2DLoaders`,
 * and `fenrir-ts/3d` adds `modelLoaders` and `textureLoaders`.
 */
export interface AssetStoreConfig {}

/**
 * The asset store as systems see it. Core has the cache only. The 2D and 3D
 * entries add their typed loading and getter methods to this interface.
 */
export interface IAssetStore {
  // Generic getter (for advanced use)
  get(key: AssetKey): Promise<unknown>;

  clear(): void;
}

/** Registers an entry's default loaders and reads its options from the config. */
type AssetStoreInstaller = (store: AssetStore, config: AssetStoreConfig) => void;

const installers: AssetStoreInstaller[] = [];

/**
 * Caches loaded assets by key and picks a loader by file extension.
 *
 * Core knows nothing about textures or models. Each asset kind ("model",
 * "texture3d", "texture2d") is added by the entry point that renders it, which
 * registers its default loaders and typed methods when it loads.
 */
export class AssetStore implements IAssetStore {
  private cache = new Map<string, Promise<unknown>>();
  private assetKinds = new Map<string, string>();
  private loaders = new Map<string, Map<string, LoaderConfig<unknown>>>();

  /**
   * Adds default loaders to every store constructed from now on. The 2D and 3D
   * entries call this when they load.
   */
  static addInstaller(installer: AssetStoreInstaller): void {
    installers.push(installer);
  }

  constructor(config: AssetStoreConfig = {}) {
    for (const install of installers) install(this, config);
  }

  /**
   * Registers a loader for one asset kind. `label` names the kind in messages,
   * for example "2D texture".
   */
  registerLoader<T>(
    kind: string,
    name: string,
    config: LoaderConfig<T>,
    label: string = kind,
  ): void {
    let byName = this.loaders.get(kind);
    if (!byName) {
      byName = new Map();
      this.loaders.set(kind, byName);
    }
    if (byName.has(name)) {
      const title = label.charAt(0).toUpperCase() + label.slice(1);
      console.warn(`${title} loader '${name}' is being overridden`);
    }
    byName.set(name, config as LoaderConfig<unknown>);
  }

  /** Sorted extensions that loaders of this kind handle. */
  getSupportedExtensions(kind: string): string[] {
    const extensions = new Set<string>();
    this.loaders.get(kind)?.forEach((config) => {
      config.extensions.forEach((ext) => extensions.add(ext));
    });
    return Array.from(extensions).sort();
  }

  /** The loader of this kind for the URL's extension. Throws if none handles it. */
  resolveLoader<T>(kind: string, url: string, label: string = kind): AssetLoader<T> {
    const ext = this.getFileExtension(url);
    for (const config of this.loaders.get(kind)?.values() ?? []) {
      if (config.extensions.includes(ext)) return config.loader as AssetLoader<T>;
    }
    const supported = this.getSupportedExtensions(kind);
    throw new Error(
      `Unsupported ${label} format: .${ext}. Supported extensions: ${supported.join(", ")}`,
    );
  }

  /** Stores a pending or loaded asset under `key`, replacing whatever was there. */
  setAsset(key: AssetKey, kind: string, asset: Promise<unknown>): void {
    this.cache.set(key, asset);
    this.assetKinds.set(key, kind);
  }

  /** The kind of asset stored under `key`, if any. */
  kindOf(key: AssetKey): string | undefined {
    return this.assetKinds.get(key);
  }

  /** The promise stored under `key`, without awaiting it. */
  peek(key: AssetKey): Promise<unknown> | undefined {
    return this.cache.get(key);
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

  async get(key: AssetKey): Promise<unknown> {
    const promise = this.cache.get(key);
    if (!promise) {
      throw new Error(`Asset not loaded: ${key}`);
    }
    return await promise;
  }

  clear(): void {
    this.cache.clear();
    this.assetKinds.clear();
  }
}
