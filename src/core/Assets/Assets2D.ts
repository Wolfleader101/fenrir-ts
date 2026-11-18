// 2D textures in the asset store. Part of fenrir-ts/2d.
//
// Loading this module adds the "texture2d" kind to AssetStore: the default Pixi
// texture loader, the `texture2DLoaders` option and the typed methods below.
import type { Texture as PixiTexture } from "pixi.js";
import { AssetStore, type AssetKey, type AssetKind, type LoaderConfig } from "./AssetStore";
import { createPixiTextureLoader } from "./loaders/pixiTextureLoader";

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

  interface AssetStoreConfig {
    texture2DLoaders?: { [name: string]: PixiTextureLoaderConfig };
  }

  interface IAssetStore {
    loadTexture2D(key: AssetKey, url: string): Promise<void>;
    getTexture2D(key: AssetKey): Promise<PixiTexture>;
    registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
    getSupportedTexture2DExtensions(): string[];
  }

  interface AssetStore {
    loadTexture2D(key: AssetKey, url: string): Promise<void>;
    /** Reuses an active or ready request for the same key and URL. Request again to retry a failure. */
    requestTexture2D(key: AssetKey, url: string): Texture2DHandle;
    getTexture2D(key: AssetKey): Promise<PixiTexture>;
    registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
    getSupportedTexture2DExtensions(): string[];
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

const methods: Pick<
  AssetStore,
  | "loadTexture2D"
  | "requestTexture2D"
  | "getTexture2D"
  | "registerTexture2DLoader"
  | "getSupportedTexture2DExtensions"
> = {
  registerTexture2DLoader(this: AssetStore, name, config) {
    this.registerLoader(KIND, name, config, LABEL);
  },

  getSupportedTexture2DExtensions(this: AssetStore) {
    return this.getSupportedExtensions(KIND);
  },

  async loadTexture2D(this: AssetStore, key, url) {
    await this.requestTexture2D(key, url).ready;
  },

  requestTexture2D(this: AssetStore, key, url) {
    const byKey = requestsOf(this);
    const existing = byKey.get(key);
    // Loading another asset under the key, or clear(), replaces the stored promise
    // and so ends the request.
    if (
      existing?.url === url &&
      existing.handle.state.status !== "failed" &&
      this.peek(key, KIND) === existing.handle.ready
    ) {
      return existing.handle;
    }

    const loader = this.resolveLoader(KIND, url, LABEL);

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
    this.setAsset(key, KIND, ready);
    return handle;
  },

  getTexture2D(this: AssetStore, key) {
    return this.get(key, KIND, LABEL);
  },
};

Object.assign(AssetStore.prototype, methods);

AssetStore.addInstaller((store, config) => {
  store.registerTexture2DLoader("pixi-texture", {
    loader: createPixiTextureLoader(),
    extensions: ["jpg", "jpeg", "png", "webp", "bmp", "gif"],
  });
  for (const [name, loaderConfig] of Object.entries(config.texture2DLoaders ?? {})) {
    store.registerTexture2DLoader(name, loaderConfig);
  }
});
