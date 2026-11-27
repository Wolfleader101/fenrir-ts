// 2D textures in the asset store. Part of fenrir-ts/2d.
//
// Loading this module adds the "texture2d" kind to AssetStore: the default Pixi
// texture loader and the `texture2DLoaders` option. The texture functions below
// are plain exports, so a game ships only the ones it calls.
import type { Texture as PixiTexture } from "pixi.js";
import { AssetStore, type AssetKey, type AssetKind, type IAssetStore, type LoaderConfig } from "./AssetStore";
import type { AssetCtx } from "./Manifest";
import { createPixiTextureLoader, unloadPixiTexture } from "./loaders/pixiTextureLoader";

/** Where a `Texture2DHandle`'s load stands. */
export type Texture2DState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly texture: PixiTexture }
  | { readonly status: "failed"; readonly error: unknown };

/** What `requestTexture2D(ctx, key, url)` returns: the texture once loaded, and where its load stands. */
export interface Texture2DHandle {
  readonly state: Texture2DState;
  readonly ready: Promise<PixiTexture>;
  /** Observes the transition out of loading. Read state for the current value. */
  subscribe(listener: (state: Texture2DState) => void): () => void;
}

/** A loader for the `texture2d` kind. */
export type PixiTextureLoaderConfig = LoaderConfig<PixiTexture>;

declare module "./AssetStore" {
  interface AssetKinds {
    texture2d: PixiTexture;
  }

  interface AssetStoreConfig {
    texture2DLoaders?: { [name: string]: PixiTextureLoaderConfig };
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

/**
 * Registers a loader for 2D textures under `name`, picked by file extension. A loader already
 * registered under `name` is replaced, with a warning. `ctx` is a `SystemCtx`, the game, or
 * anything with its `assets`.
 *
 * ```ts
 * registerTexture2DLoader(game, "ktx2", { loader: loadKtx2, extensions: ["ktx2"] });
 * ```
 */
export function registerTexture2DLoader(ctx: Pick<AssetCtx, "assets">, name: string, config: PixiTextureLoaderConfig): void {
  ctx.assets.registerLoader(KIND, name, config, LABEL);
}

/**
 * The file extensions the registered 2D texture loaders handle, sorted. With only the default
 * Pixi loader: `bmp`, `gif`, `jpeg`, `jpg`, `png`, `svg`, `webp`.
 */
export function getSupportedTexture2DExtensions(ctx: Pick<AssetCtx, "assets">): string[] {
  return ctx.assets.getSupportedExtensions(KIND);
}

/**
 * Starts loading the texture at `url` and stores it under `key`, returning a handle with its
 * `state`, a `ready` promise and `subscribe`. Reuses an active or ready request for the same key
 * and URL; request again to retry a failure. Loading another asset under `key`, or
 * `assets.clear()`, ends the request. Throws if no loader handles the URL's extension.
 *
 * ```ts
 * const handle = requestTexture2D(game, "logo", "img/logo.png");
 * handle.subscribe((state) => { if (state.status === "ready") show(state.texture); });
 * ```
 */
export function requestTexture2D(ctx: Pick<AssetCtx, "assets">, key: AssetKey, url: string): Texture2DHandle {
  const store = ctx.assets;
  const byKey = requestsOf(store);
  const existing = byKey.get(key);
  // Loading another asset under the key, or clear(), replaces the stored promise
  // and so ends the request.
  if (
    existing?.url === url &&
    existing.handle.state.status !== "failed" &&
    store.peek(key, KIND) === existing.handle.ready
  ) {
    return existing.handle;
  }

  const loader = store.resolveLoader(KIND, url, LABEL);

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
  store.setAsset(key, KIND, ready);
  return handle;
}

/**
 * Loads the texture at `url` under `key`: `requestTexture2D(ctx, key, url).ready`, without the
 * texture. Rejects if the load fails.
 *
 * ```ts
 * await loadTexture2D(game, "logo", "img/logo.png");
 * ```
 */
export async function loadTexture2D(ctx: Pick<AssetCtx, "assets">, key: AssetKey, url: string): Promise<void> {
  await requestTexture2D(ctx, key, url).ready;
}

/**
 * The texture stored under `key`, once it has loaded: one from `requestTexture2D` or
 * `loadTexture2D`, or a manifest's `texture2d` asset by its name. Rejects if nothing is stored
 * under `key`, if its load failed, or if the asset there is not a 2D texture.
 *
 * ```ts
 * const texture = await getTexture2D(ctx, "logo");
 * ```
 */
export function getTexture2D(ctx: Pick<AssetCtx, "assets">, key: AssetKey): Promise<PixiTexture> {
  return readTexture2D(ctx.assets, key);
}

/** `getTexture2D` on a store. Internal: the renderer holds a store, not a ctx. */
export function readTexture2D(store: IAssetStore, key: AssetKey): Promise<PixiTexture> {
  return store.get(key, KIND, LABEL);
}

AssetStore.addInstaller((store, config) => {
  store.registerLoader(KIND, "pixi-texture", {
    loader: createPixiTextureLoader(),
    extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg"],
    unload: unloadPixiTexture,
  }, LABEL);
  for (const [name, loaderConfig] of Object.entries(config.texture2DLoaders ?? {})) {
    store.registerLoader(KIND, name, loaderConfig, LABEL);
  }
});
