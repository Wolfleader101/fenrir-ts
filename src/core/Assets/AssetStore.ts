import type { AssetLoader, AssetSource } from "./AssetLoader";

export type AssetKey = string & { __assetKey?: true };
export const assetKey = (k: string) => k as AssetKey;

/** A loader and the file extensions it handles. */
export type LoaderConfig<T> = {
  loader: AssetLoader<T>;
  extensions: string[];
  /**
   * Frees an asset this loader loaded, such as a GPU texture. Called by `unloadAssets` when the
   * last bundle holding the asset is unloaded. Optional: without it the asset is only dropped.
   */
  unload?: (asset: T, src: AssetSource) => void | Promise<void>;
};

/**
 * The asset kinds this program can load, mapped to the type a loaded asset of
 * that kind has. Empty in core: `fenrir-ts/2d` adds `texture2d`, and
 * `fenrir-ts/3d` adds `model` and `texture3d`. A game adds its own kinds the
 * same way, with `declare module "fenrir-ts" { interface AssetKinds { ... } }`.
 */
export interface AssetKinds {}

/** The name of an asset kind this program knows. */
export type AssetKind = keyof AssetKinds & string;

/**
 * Any loaded asset: the union of every kind this program knows. `never` when
 * no kind is known, because then nothing can be stored.
 */
export type Asset = AssetKinds[AssetKind];

/**
 * The asset store as systems see it: the cache. `fenrir-ts/3d` extends it as `IAssetStore3D`;
 * `fenrir-ts/2d` reads and loads 2D textures with functions (`requestTexture2D`, `getTexture2D`).
 */
export interface IAssetStore {
  /** The asset stored under `key`, whatever its kind. Rejects if nothing is stored. */
  get(key: AssetKey): Promise<Asset>;
  /**
   * The asset stored under `key`. Rejects if nothing is stored, or if the asset
   * is of another kind; `label` names the kind in that message.
   */
  get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;

  clear(): void;
}

/**
 * Caches loaded assets by key and picks a loader by file extension.
 *
 * Core knows nothing about textures or models, and nothing adds methods to this class. Each
 * asset kind ("texture2d", "model", "texture3d", "audio") is added by the code that renders or
 * plays it, which registers its loaders on a store with `registerLoader`: the `pixi2d` and
 * `audio` plugins when they install, `AssetStore3D` when it is constructed, and the 2D texture
 * functions on first use.
 */
export class AssetStore implements IAssetStore {
  private cache = new Map<string, Promise<Asset>>();
  private assetKinds = new Map<string, AssetKind>();
  private loaders = new Map<string, Map<string, LoaderConfig<Asset>>>();

  /** Whether a loader called `name` is registered for `kind`. */
  hasLoader(kind: AssetKind, name: string): boolean {
    return this.loaders.get(kind)?.has(name) ?? false;
  }

  /**
   * Registers a loader for one asset kind. `label` names the kind in messages,
   * for example "2D texture".
   */
  registerLoader<K extends AssetKind>(
    kind: K,
    name: string,
    config: LoaderConfig<AssetKinds[K]>,
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
    // Stored by kind: resolveLoader hands it out only for kind K.
    byName.set(name, config as unknown as LoaderConfig<Asset>);
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
  resolveLoader<K extends AssetKind>(
    kind: K,
    url: string,
    label: string = kind,
  ): AssetLoader<AssetKinds[K]> {
    const ext = this.getFileExtension(url);
    for (const config of this.loaders.get(kind)?.values() ?? []) {
      // registerLoader stores only loaders of AssetKinds[K] under kind K.
      if (config.extensions.includes(ext)) return config.loader as AssetLoader<AssetKinds[K]>;
    }
    const supported = this.getSupportedExtensions(kind);
    throw new Error(
      `Unsupported ${label} format: .${ext}. Supported extensions: ${supported.join(", ")}`,
    );
  }

  /** Stores a pending or loaded asset under `key`, replacing whatever was there. */
  setAsset<K extends AssetKind>(key: AssetKey, kind: K, asset: Promise<AssetKinds[K]>): void {
    this.cache.set(key, asset);
    this.assetKinds.set(key, kind);
  }

  /** The kind of asset stored under `key`, if any. */
  kindOf(key: AssetKey): AssetKind | undefined {
    return this.assetKinds.get(key);
  }

  /** The promise stored under `key` if it is of this kind, without awaiting it. */
  peek<K extends AssetKind>(key: AssetKey, kind: K): Promise<AssetKinds[K]> | undefined {
    // setAsset stores only promises of AssetKinds[K] under kind K.
    return this.assetKinds.get(key) === kind
      ? (this.cache.get(key) as Promise<AssetKinds[K]>)
      : undefined;
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

  get(key: AssetKey): Promise<Asset>;
  get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;
  async get(key: AssetKey, kind?: AssetKind, label: string | undefined = kind): Promise<Asset> {
    const promise = this.cache.get(key);
    if (!promise) {
      throw new Error(`Asset not loaded: ${key}`);
    }
    const asset = await promise;
    if (kind !== undefined && this.kindOf(key) !== kind) {
      throw new Error(`Asset "${key}" is not a ${label}`);
    }
    return asset;
  }

  clear(): void {
    this.cache.clear();
    this.assetKinds.clear();
  }
}
