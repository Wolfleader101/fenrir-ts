// 2D textures in the asset store. Part of fenrir-ts/2d.
//
// Adds the "texture2d" kind to AssetKinds (types only) and the functions below. Nothing here
// runs at import or patches AssetStore: `pixi2d` registers the default Pixi loader on
// `game.assets` when it installs, and the functions register it on any other store the first
// time they load into it.
import type { Texture as PixiTexture } from "pixi.js";
import type { AssetKey, AssetKind, AssetStore, LoaderConfig } from "./AssetStore";
import { createPixiTextureLoader, unloadPixiTexture } from "./loaders/pixiTextureLoader";

export type Texture2DState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly texture: PixiTexture }
  | { readonly status: "failed"; readonly error: unknown };

export interface Texture2DHandle {
  readonly state: Texture2DState;
  readonly ready: Promise<PixiTexture>;
  /** Observes the transition out of loading. Read state for the current value. */
  subscribe(listener: (state: Texture2DState) => void): () => void;
}

export type PixiTextureLoaderConfig = LoaderConfig<PixiTexture>;

declare module "./AssetStore" {
  interface AssetKinds {
    texture2d: PixiTexture;
  }
}

const KIND = "texture2d" satisfies AssetKind;
const LABEL = "2D texture";

/** The last request per key. A request is current while the store still holds its promise. */
const requests = new WeakMap<AssetStore, Map<AssetKey, { url: string; handle: Texture2DHandle }>>();

function requestsOf(store: AssetStore) {
  let byKey = requests.get(store);
  if (!byKey) {
    byKey = new Map();
    requests.set(store, byKey);
  }
  return byKey;
}

/** The name of the default loader, which loads through Pixi's `Assets` (jpg, jpeg, png, webp, bmp, gif). */
export const PIXI_TEXTURE_LOADER = "pixi-texture";

/**
 * Registers the default Pixi texture loader on `assets`, unless one called `"pixi-texture"`
 * is there already. `pixi2d` calls it when it installs; the loading functions call it too.
 */
export function addPixiTextureLoader(assets: AssetStore): void {
  if (assets.hasLoader(KIND, PIXI_TEXTURE_LOADER)) return;
  assets.registerLoader(KIND, PIXI_TEXTURE_LOADER, {
    loader: createPixiTextureLoader(),
    extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"],
    unload: unloadPixiTexture,
  }, LABEL);
}

/** Registers a 2D texture loader for its file extensions. A loader with the same name is replaced, with a warning. */
export function registerTexture2DLoader(assets: AssetStore, name: string, config: PixiTextureLoaderConfig): void {
  assets.registerLoader(KIND, name, config, LABEL);
}

/** The file extensions the store's 2D texture loaders handle, sorted. */
export function getSupportedTexture2DExtensions(assets: AssetStore): string[] {
  return assets.getSupportedExtensions(KIND);
}

/** Loads the texture at `url` under `key`, as `requestTexture2D` does, and resolves when it is ready. */
export async function loadTexture2D(assets: AssetStore, key: AssetKey, url: string): Promise<void> {
  await requestTexture2D(assets, key, url).ready;
}

/**
 * Starts loading the texture at `url` under `key` and returns a handle to its state. Reuses an
 * active or ready request for the same key and URL. Request again to retry a failure.
 */
export function requestTexture2D(assets: AssetStore, key: AssetKey, url: string): Texture2DHandle {
  const byKey = requestsOf(assets);
  const existing = byKey.get(key);
  // Loading another asset under the key, or clear(), replaces the stored promise
  // and so ends the request.
  if (
    existing?.url === url &&
    existing.handle.state.status !== "failed" &&
    assets.peek(key, KIND) === existing.handle.ready
  ) {
    return existing.handle;
  }

  addPixiTextureLoader(assets);
  const loader = assets.resolveLoader(KIND, url, LABEL);

  let state: Texture2DState = { status: "loading" };
  const listeners = new Set<(state: Texture2DState) => void>();
  const settle = (next: Texture2DState) => {
    state = next;
    const pending = [...listeners];
    listeners.clear();
    for (const listener of pending) {
      try { listener(next); } catch (error) { console.error("Texture readiness listener failed", error); }
    }
  };

  const ready = Promise.resolve().then(() => loader({ url })).then(
    (texture) => {
      settle({ status: "ready", texture });
      return texture;
    },
    (error: unknown) => {
      settle({ status: "failed", error });
      throw error;
    },
  );
  // Consumers can use state and subscribe without awaiting the load.
  void ready.catch(() => {});

  const handle: Texture2DHandle = {
    get state() { return state; },
    ready,
    subscribe(listener) {
      if (state.status === "loading") listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  byKey.set(key, { url, handle });
  assets.setAsset(key, KIND, ready);
  return handle;
}

/** The 2D texture stored under `key`. Rejects if nothing is stored there, or something else is. */
export function getTexture2D(assets: Pick<AssetStore, "get">, key: AssetKey): Promise<PixiTexture> {
  return assets.get(key, KIND, LABEL);
}
