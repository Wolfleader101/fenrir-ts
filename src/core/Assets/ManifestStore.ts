// The per-store state of asset manifests, apart from Manifest.ts so that fenrir-ts/audio can read
// a loaded sample by name without pulling the manifest code into its chunk.
import { assetKey, type Asset, type AssetKind, type AssetStore } from "./AssetStore";
import type { AssetManifest, ManifestLoader } from "./Manifest";
import type { Resources } from "../Resource";

export type EntryStatus = "loading" | "loaded" | "fallback" | "missing" | "failed";

/** One asset loaded into a store, shared by every bundle (of any manifest) that holds it. */
export interface Entry {
  readonly kind: AssetKind;
  readonly src: string;
  status: EntryStatus;
  value: Asset | undefined;
  /** What the loader threw, once it has. */
  error?: unknown;
  promise: Promise<Asset>;
  /** `manifest/bundle` of each loading or loaded bundle that holds it, and `manifest#asset` for a `loadAsset` hold. */
  readonly users: Set<string>;
  unload?: (value: Asset) => void;
}

export interface BundleState {
  status: "loading" | "loaded" | "failed";
  promise: Promise<void>;
}

export interface ManifestRuntime {
  readonly manifest: AssetManifest;
  readonly resources: Resources;
  readonly bundles: Map<string, BundleState>;
  /** Assets held by name through `loadAsset`, each like a bundle of that asset and its fallback. */
  readonly direct: Map<string, BundleState>;
}

export interface StoreState {
  readonly entries: Map<string, Entry>;
  readonly manifests: Map<string, ManifestRuntime>;
  loader?: ManifestLoader;
}

const stores = new WeakMap<AssetStore, StoreState>();

export function storeState(store: AssetStore): StoreState {
  let state = stores.get(store);
  if (!state) stores.set(store, (state = { entries: new Map(), manifests: new Map() }));
  return state;
}

/** The store's entry for `name`, while the store still holds its promise. `assets.clear()` ends it. */
export function liveEntry(store: AssetStore, state: StoreState, name: string): Entry | undefined {
  const entry = state.entries.get(name);
  if (entry && store.peek(assetKey(name), entry.kind) !== entry.promise) {
    state.entries.delete(name);
    return undefined;
  }
  return entry;
}

/**
 * Internal. The value of asset `name` in `store` if a manifest has loaded it, or its fallback,
 * without awaiting anything. `fenrir-ts/audio` reads samples with it when a sound plays.
 */
export function peekLoadedAsset(store: AssetStore, name: string): Asset | undefined {
  const entry = liveEntry(store, storeState(store), name);
  return entry?.status === "loaded" || entry?.status === "fallback" ? entry.value : undefined;
}
