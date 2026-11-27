// Asset manifests: assets declared once by name, grouped in bundles, loaded with progress.
//
// Opt-in, like motion(): nothing here is reachable from code that does not import it, so a game
// without a manifest ships none of it. Loads go through the game's AssetStore (its loaders and
// cache), so `getTexture2D(name)` and `renderSprite(name)` see a manifest's assets too.
import type { EventBus } from "../EventBus";
import { defineEvent } from "../EventQueue";
import type { ILogger } from "../ILogger";
import { defineResource, type ResourceType, type Resources } from "../Resource";
import { assetKey, type Asset, type AssetKind, type AssetKinds, type AssetStore, type LoaderConfig } from "./AssetStore";
import { liveEntry, storeState, type BundleState, type Entry, type ManifestRuntime, type StoreState } from "./ManifestStore";

/** One asset of a manifest: its kind, where it loads from, and optionally a fallback. */
export interface AssetDeclaration<Name extends string = string> {
  /** An asset kind this program knows, such as `"texture2d"` from `fenrir-ts/2d`. */
  readonly kind: AssetKind;
  /** The URL the kind's loader reads, chosen by its extension. */
  readonly src: string;
  /**
   * Another asset of the same manifest and kind, used in this one's place if it fails to load.
   * Every bundle that lists this asset also loads the fallback. A fallback has no fallback.
   */
  readonly fallback?: Name;
  /**
   * `true`: a failure is cosmetic. If it fails (and its fallback, if any, fails too) it is
   * `missing`: logged as a warning, counted in `missing`, and its bundle still loads.
   * `getAsset` returns `undefined` for it. Default `false`: a failure fails the bundle.
   */
  readonly optional?: boolean;
}

/** The assets of a manifest, by name. */
export type AssetDeclarations = { readonly [name: string]: AssetDeclaration };

/**
 * Where one asset of a manifest stands. `fallback`: it failed and its fallback is shown instead.
 * `missing`: an `optional` asset that failed with no fallback to show; `getAsset` returns `undefined`.
 */
export type AssetStatus = "unloaded" | "loading" | "loaded" | "fallback" | "missing" | "failed";
/** Where one bundle stands. `failed`: an asset without a fallback failed; the others loaded. */
export type BundleStatus = "unloaded" | "loading" | "loaded" | "failed";

/** One asset in `AssetProgress`. */
export interface AssetState {
  status: AssetStatus;
  /** Why it failed, when its status is `failed` or `fallback`. */
  error: string | null;
  /** The loading or loaded bundles of this manifest that hold it. It is unloaded when none do and `direct` is false. */
  bundles: string[];
  /** Whether `loadAsset` holds it by name (until `unloadAsset`), apart from any bundle. */
  direct: boolean;
}

/** Counts over a set of assets. `fraction` is `(loaded + missing) / total`, or 1 when `total` is 0. */
export interface AssetCounts {
  /** Assets ready to read: loaded, or showing their fallback. */
  loaded: number;
  /** Optional assets that failed with nothing to show. They count as done, not failed. */
  missing: number;
  /** Assets that failed with no fallback and are not optional. */
  failed: number;
  total: number;
  fraction: number;
}

/** One bundle in `AssetProgress`. Its counts include the fallbacks it loads. */
export interface BundleProgress extends AssetCounts {
  status: BundleStatus;
}

/**
 * A manifest's progress, as plain data: the value of `manifest.progress`, a resource, so a HUD
 * reads it each frame with `ctx.resources.get(manifest.progress)` and `inspect(game)` shows it.
 * The top-level counts are over every asset a loading or loaded bundle, or `loadAsset`, holds.
 */
export interface AssetProgress<A extends string = string, B extends string = string> extends AssetCounts {
  bundles: Record<B, BundleProgress>;
  assets: Record<A, AssetState>;
}

/** A manifest, made by `defineAssets`. Plain data apart from `progress`, which is a resource handle. */
export interface AssetManifest<A extends AssetDeclarations = AssetDeclarations, B extends string = string> {
  /** Namespaced, such as `myGame.assets`. Also the name of `progress`. */
  readonly name: string;
  readonly assets: A;
  /** Asset names per bundle, as declared. */
  readonly bundles: { readonly [K in B]: readonly (keyof A & string)[] };
  /** The resource that holds this manifest's `AssetProgress` in each game. */
  readonly progress: ResourceType<AssetProgress<keyof A & string, B>>;
}

/** The name of an asset of `M`. */
export type AssetName<M extends AssetManifest<any, any>> = keyof M["assets"] & string;
/** The name of a bundle of `M`. */
export type BundleName<M extends AssetManifest<any, any>> = keyof M["bundles"] & string;
/**
 * What `getAsset` returns for asset `N`: the loaded type of its kind, plus `undefined` when it is
 * declared `optional: true` (a missing optional asset has no value).
 */
export type ManifestAsset<A extends AssetDeclarations, N extends keyof A> =
  | AssetKinds[A[N]["kind"]]
  | (A[N] extends { readonly optional: true } ? undefined : never);

/** What the manifest functions need: a `SystemCtx`, or the `Game` or `TestGame` itself. */
export type AssetCtx = {
  readonly assets: AssetStore;
  readonly resources: Resources;
  readonly events: EventBus;
  readonly logger: ILogger;
};

/** One asset that failed with no fallback. */
export interface AssetFailure {
  asset: string;
  src: string;
  error: string;
}

/**
 * Sent when a bundle has loaded: every asset ready, showing its fallback (`fallbacks`), or an
 * optional asset that is missing (`missing`).
 */
export const AssetBundleLoaded = defineEvent<{ manifest: string; bundle: string; fallbacks: string[]; missing: string[] }>(
  "fenrir.assets.bundleLoaded",
);
/** Sent when a bundle has settled with at least one asset failed and no fallback for it. */
export const AssetBundleFailed = defineEvent<{ manifest: string; bundle: string; failures: AssetFailure[] }>("fenrir.assets.bundleFailed");

/**
 * Sent when an asset requested by name with `loadAsset` has settled without failing. `status` is
 * `loaded`, `fallback` (its fallback is shown) or `missing` (optional, nothing to show).
 */
export const AssetLoaded = defineEvent<{ manifest: string; asset: string; status: "loaded" | "fallback" | "missing" }>("fenrir.assets.loaded");
/** Sent when an asset requested by name with `loadAsset` failed, with no fallback and not optional. */
export const AssetFailed = defineEvent<{ manifest: string } & AssetFailure>("fenrir.assets.failed");

/** The rejection of `loadAsset` when the asset failed, with no fallback and not optional. */
export class AssetLoadError extends Error {
  readonly manifest: string;
  readonly asset: string;
  readonly src: string;

  constructor(manifest: string, failure: AssetFailure, cause: unknown) {
    super(`Asset "${failure.asset}" of ${manifest} failed to load from "${failure.src}": ${failure.error}`, { cause });
    this.name = "AssetLoadError";
    this.manifest = manifest;
    this.asset = failure.asset;
    this.src = failure.src;
  }
}

/** The rejection of `loadAssets` when a bundle failed. Every asset of the bundle was tried first. */
export class AssetBundleError extends Error {
  readonly manifest: string;
  readonly bundle: string;
  readonly failures: readonly AssetFailure[];

  constructor(manifest: string, bundle: string, failures: readonly AssetFailure[], cause: unknown) {
    super(
      `Bundle "${bundle}" of ${manifest} failed: ` +
        failures.map((f) => `asset "${f.asset}" from "${f.src}": ${f.error}`).join("; "),
      { cause },
    );
    this.name = "AssetBundleError";
    this.manifest = manifest;
    this.bundle = bundle;
    this.failures = failures;
  }
}

/**
 * Loads manifest assets in place of the store's loaders. See `setAssetLoader`. `load` gets each
 * asset's `name`, `kind` and `src` as declared, and resolves with its value or rejects.
 */
export interface ManifestLoader {
  load(asset: { readonly name: string; readonly kind: AssetKind; readonly src: string }): Promise<unknown>;
  /** Called with the loaded value when the last bundle holding an asset is unloaded. */
  unload?(asset: { readonly name: string; readonly kind: AssetKind; readonly src: string }, value: unknown): void;
}

const noop = (): void => {};
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const userOf = (manifest: AssetManifest, bundle: string): string => `${manifest.name}/${bundle}`;
const directUserOf = (manifest: AssetManifest, asset: string): string => `${manifest.name}#${asset}`;

/** The bundle's assets and the fallbacks they name, in declaration order, once each. */
function membersOf(manifest: AssetManifest, bundle: string): string[] {
  return withFallbacks(manifest, manifest.bundles[bundle]!);
}

/** `names` and the fallbacks they name, in order, once each. */
function withFallbacks(manifest: AssetManifest, names: readonly string[]): string[] {
  const members = new Set<string>();
  for (const name of names) {
    members.add(name);
    const fallback = manifest.assets[name]!.fallback;
    if (fallback) members.add(fallback);
  }
  return [...members];
}

function counts(entries: Map<string, Entry>, names: Iterable<string>): AssetCounts {
  let loaded = 0;
  let missing = 0;
  let failed = 0;
  let total = 0;
  for (const name of names) {
    total++;
    const status = entries.get(name)?.status;
    if (status === "loaded" || status === "fallback") loaded++;
    else if (status === "missing") missing++;
    else if (status === "failed") failed++;
  }
  return { loaded, missing, failed, total, fraction: total ? (loaded + missing) / total : 1 };
}

function emptyProgress(manifest: AssetManifest): AssetProgress {
  const bundles: Record<string, BundleProgress> = {};
  for (const bundle in manifest.bundles) {
    bundles[bundle] = { status: "unloaded", loaded: 0, missing: 0, failed: 0, total: 0, fraction: 1 };
  }
  const assets: Record<string, AssetState> = {};
  for (const name in manifest.assets) assets[name] = { status: "unloaded", error: null, bundles: [], direct: false };
  return { loaded: 0, missing: 0, failed: 0, total: 0, fraction: 1, bundles, assets };
}

/** Rewrites every manifest's progress in place from the store's entries. */
function refresh(state: StoreState): void {
  for (const { manifest, resources, bundles, direct } of state.manifests.values()) {
    const progress = resources.get(manifest.progress);
    const next = emptyProgress(manifest);
    const held = new Set<string>();
    for (const [bundle, { status }] of bundles) {
      const members = membersOf(manifest, bundle);
      next.bundles[bundle] = { status, ...counts(state.entries, members) };
      for (const name of members) {
        held.add(name);
        next.assets[name]!.bundles.push(bundle);
      }
    }
    for (const name of direct.keys()) {
      next.assets[name]!.direct = true;
      for (const member of withFallbacks(manifest, [name])) held.add(member);
    }
    for (const name of held) {
      const entry = state.entries.get(name);
      const { bundles: holders, direct: byName } = next.assets[name]!;
      if (entry) next.assets[name] = { status: entry.status, error: "error" in entry ? message(entry.error) : null, bundles: holders, direct: byName };
    }
    Object.assign(progress, next, counts(state.entries, held));
  }
}

function runtimeOf(ctx: AssetCtx, manifest: AssetManifest): ManifestRuntime {
  const state = storeState(ctx.assets);
  let runtime = state.manifests.get(manifest.name);
  if (!runtime) {
    runtime = { manifest, resources: ctx.resources, bundles: new Map(), direct: new Map() };
    state.manifests.set(manifest.name, runtime);
  }
  return runtime;
}

function checkBundle(caller: string, manifest: AssetManifest, bundle: string): void {
  if (!Object.prototype.hasOwnProperty.call(manifest.bundles, bundle)) {
    throw new Error(`${caller}: ${manifest.name} has no bundle "${bundle}". Its bundles: ${Object.keys(manifest.bundles).join(", ")}.`);
  }
}

function checkAsset(caller: string, manifest: AssetManifest, name: string): void {
  if (!Object.prototype.hasOwnProperty.call(manifest.assets, name)) {
    throw new Error(`${caller}: ${manifest.name} has no asset "${name}". Its assets: ${Object.keys(manifest.assets).join(", ")}.`);
  }
}

function startEntry(ctx: AssetCtx, state: StoreState, manifest: AssetManifest, name: string, users: Iterable<string>): Entry {
  const { kind, src, fallback, optional } = manifest.assets[name]!;
  const store = ctx.assets;
  const asset = { name, kind, src };
  const override = state.loader;
  const entry: Entry = { kind, src, status: "loading", value: undefined, promise: undefined!, users: new Set(users) };

  const load = (): Promise<Asset> => {
    if (override) {
      entry.unload = override.unload && ((value) => override.unload!(asset, value));
      return override.load(asset) as Promise<Asset>;
    }
    const loader = store.resolveLoader(kind, src);
    // registerLoader keeps the configs by kind; find the one resolveLoader picked, for its unload.
    for (const config of (store["loaders"].get(kind)?.values() ?? []) as Iterable<LoaderConfig<Asset>>) {
      if (config.loader === loader && config.unload) entry.unload = (value) => config.unload!(value, { url: src });
    }
    return loader({ url: src });
  };

  entry.promise = Promise.resolve()
    .then(load)
    .then(
      (value) => {
        entry.status = "loaded";
        entry.value = value;
        return value;
      },
      async (error: unknown) => {
        entry.error = error;
        const backup = fallback ? state.entries.get(fallback) : undefined;
        if (backup) {
          try {
            const value = await backup.promise;
            // A missing optional fallback resolves with nothing to show: treat it as failed.
            if (backup.status !== "loaded") throw backup.error;
            entry.status = "fallback";
            entry.value = value;
            ctx.logger.warn(`Asset "${name}" of ${manifest.name} failed to load from "${src}"; showing "${fallback}"`, { error });
            return value;
          } catch {
            // The fallback failed too: this asset fails (or is missing) with its own error.
          }
        }
        if (optional) {
          // Cosmetic: resolve with no value, so the store's getters and the bundle carry on.
          entry.status = "missing";
          ctx.logger.warn(`Optional asset "${name}" of ${manifest.name} failed to load from "${src}"; it is missing`, { error });
          return undefined as unknown as Asset;
        }
        entry.status = "failed";
        throw error;
      },
    )
    .finally(() => refresh(state));
  void entry.promise.catch(noop);
  state.entries.set(name, entry);
  store.setAsset(assetKey(name), kind, entry.promise);
  return entry;
}

/** Drops an entry no bundle holds: out of the store's cache, then its loader's unload. */
function release(store: AssetStore, state: StoreState, name: string, entry: Entry): void {
  state.entries.delete(name);
  const key = assetKey(name);
  if (store["cache"].get(key) === entry.promise) {
    store["cache"].delete(key);
    store["assetKinds"].delete(key);
  }
  // A fallback's value belongs to the fallback's own entry, released on its own.
  void entry.promise.then(() => {
    if (entry.status === "loaded" && entry.unload) entry.unload(entry.value!);
  }, noop);
}

/**
 * Holds `members` for `user` and returns the hold's promise, settled once every member has: the
 * shared part of loading a bundle and loading an asset by name. `label` names it in errors.
 */
function hold(
  ctx: AssetCtx,
  manifest: AssetManifest,
  holds: Map<string, BundleState>,
  key: string,
  user: string,
  label: string,
  members: readonly string[],
  settled: (entries: Map<string, Entry>) => void,
): Promise<void> {
  const store = ctx.assets;
  const state = storeState(store);
  const current = holds.get(key);
  if (current && current.status !== "failed") return current.promise;

  // A first load, a load after unload, or a retry: assets that failed load again, the rest are shared.
  const entries = new Map<string, Entry>();
  for (const name of members) {
    const { kind, src } = manifest.assets[name]!;
    let entry = liveEntry(store, state, name);
    if (entry && (entry.kind !== kind || entry.src !== src)) {
      throw new Error(`loadAssets: "${name}" of ${manifest.name} is ${kind} from "${src}", but "${name}" is already loaded as ${entry.kind} from "${entry.src}". Rename one.`);
    }
    if (!entry || entry.status === "failed") entry = startEntry(ctx, state, manifest, name, entry?.users ?? []);
    entry.users.add(user);
    entries.set(name, entry);
  }

  const holdState: BundleState = { status: "loading", promise: undefined! };
  holdState.promise = Promise.allSettled([...entries.values()].map((entry) => entry.promise)).then(() => {
    if (holds.get(key) !== holdState) {
      throw new Error(`${label} of ${manifest.name} was unloaded before it finished loading.`);
    }
    const failed = [...entries.values()].some((entry) => entry.status === "failed");
    holdState.status = failed ? "failed" : "loaded";
    refresh(state);
    settled(entries);
  });
  void holdState.promise.catch(noop);
  holds.set(key, holdState);
  refresh(state);
  return holdState.promise;
}

function loadBundle(ctx: AssetCtx, manifest: AssetManifest, bundle: string): Promise<void> {
  const runtime = runtimeOf(ctx, manifest);
  const members = membersOf(manifest, bundle);
  return hold(ctx, manifest, runtime.bundles, bundle, userOf(manifest, bundle), `Bundle "${bundle}"`, members, (entries) => {
    const failures: AssetFailure[] = [];
    const fallbacks: string[] = [];
    const missing: string[] = [];
    let cause: unknown;
    for (const [name, entry] of entries) {
      if (entry.status === "fallback") fallbacks.push(name);
      if (entry.status === "missing") missing.push(name);
      if (entry.status !== "failed") continue;
      if (!failures.length) cause = entry.error;
      failures.push({ asset: name, src: entry.src, error: message(entry.error) });
    }
    if (!failures.length) {
      ctx.events.send(AssetBundleLoaded, { manifest: manifest.name, bundle, fallbacks, missing });
      return;
    }
    const error = new AssetBundleError(manifest.name, bundle, failures, cause);
    ctx.logger.error(error.message, { manifest: manifest.name, bundle, failures });
    ctx.events.send(AssetBundleFailed, { manifest: manifest.name, bundle, failures });
    throw error;
  });
}

function loadOne(ctx: AssetCtx, manifest: AssetManifest, name: string): Promise<void> {
  const runtime = runtimeOf(ctx, manifest);
  const members = withFallbacks(manifest, [name]);
  return hold(ctx, manifest, runtime.direct, name, directUserOf(manifest, name), `Asset "${name}"`, members, (entries) => {
    const entry = entries.get(name)!;
    if (entry.status !== "failed") {
      const status = entry.status as "loaded" | "fallback" | "missing";
      ctx.events.send(AssetLoaded, { manifest: manifest.name, asset: name, status });
      return;
    }
    const failure: AssetFailure = { asset: name, src: entry.src, error: message(entry.error) };
    const error = new AssetLoadError(manifest.name, failure, entry.error);
    ctx.logger.error(error.message, { manifest: manifest.name, asset: name });
    ctx.events.send(AssetFailed, { manifest: manifest.name, ...failure });
    throw error;
  });
}

/** Drops `user`'s hold on `members`, releasing each asset nothing else holds. */
function drop(store: AssetStore, state: StoreState, user: string, members: readonly string[]): void {
  for (const name of members) {
    const entry = state.entries.get(name);
    if (!entry?.users.delete(user) || entry.users.size) continue;
    release(store, state, name, entry);
  }
}

/**
 * Declares a game's assets once, by name, and groups them into bundles: `boot`, and one per level
 * or location. Plain data: `manifest.assets` and `manifest.bundles` are what was passed, so a
 * tool or a test can read them. An asset in two bundles is loaded once and kept until the last
 * bundle holding it is unloaded.
 *
 * An asset's name is its key in `game.assets`, so `getTexture2D(name)` and `renderSprite(name)`
 * read it too. Two manifests that use one name must declare the same kind and source.
 *
 * Mark an asset `optional: true` when a failure is cosmetic: it is then `missing` (a warning, not
 * an error), its bundle still loads, and `getAsset` returns `undefined` for it. To load assets one
 * at a time rather than in bundles, use `loadAsset` and `unloadAsset`.
 *
 * Throws if a bundle lists an unknown asset, a fallback is unknown, of another kind or has its
 * own fallback, or two assets of one kind share a source.
 *
 * @example
 * const GameAssets = defineAssets("myGame.assets", {
 *   assets: {
 *     logo: { kind: "texture2d", src: "img/logo.png" },
 *     missing: { kind: "texture2d", src: "img/missing.png" },
 *     reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
 *     glow: { kind: "texture2d", src: "img/glow.png", optional: true },
 *   },
 *   bundles: { boot: ["logo"], reef: ["reef", "logo"] },
 * });
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineAssets<
  const A extends AssetDeclarations,
  const B extends { readonly [bundle: string]: readonly (keyof A & string)[] },
>(
  name: string,
  manifest: {
    readonly assets: A & { readonly [N in keyof A]: { readonly fallback?: keyof A & string } };
    readonly bundles: B;
  },
): AssetManifest<A, keyof B & string> {
  const { assets, bundles } = manifest;
  const fail = (text: string): never => {
    throw new Error(`defineAssets("${name}"): ${text}.`);
  };
  const sources = new Map<string, string>();
  for (const asset in assets) {
    const { kind, src, fallback } = assets[asset]!;
    const source = `${kind} ${src}`;
    if (sources.has(source)) fail(`"${sources.get(source)}" and "${asset}" both load ${kind} from "${src}". Declare it once`);
    sources.set(source, asset);
    if (fallback === undefined) continue;
    const backup = assets[fallback];
    if (!backup || backup.kind !== kind || backup.fallback !== undefined) {
      fail(`the fallback of "${asset}" must be another ${kind} asset with no fallback of its own; "${fallback}" is not`);
    }
  }
  for (const bundle in bundles) {
    for (const asset of bundles[bundle]!) {
      if (!(asset in assets)) fail(`bundle "${bundle}" lists "${asset}", which is not an asset`);
    }
  }
  type Progress = AssetProgress<keyof A & string, keyof B & string>;
  const result: AssetManifest<A, keyof B & string> = Object.freeze({
    name,
    assets: assets as A,
    bundles,
    progress: defineResource<Progress>(name, () => emptyProgress(result as unknown as AssetManifest) as Progress),
  });
  return result;
}

/**
 * Loads one or more bundles of `manifest` into the game's asset store, with progress in
 * `manifest.progress`. Call it from a system (without awaiting in a sync stage) or from setup
 * code. Safe to call again: a loading or loaded bundle returns the same promise, and an asset
 * shared with another bundle is loaded once. Calling it on a failed bundle retries the assets
 * that failed.
 *
 * Every asset of a bundle is tried. An asset that fails shows its fallback if it declares one;
 * one that fails without a fallback fails the bundle, which is logged, sends `AssetBundleFailed`
 * and rejects with an `AssetBundleError` naming each asset and source. The assets that loaded
 * stay loaded. A bundle with no failure sends `AssetBundleLoaded` and resolves.
 *
 * To hold `run()` until a bundle is ready, await it in a `PreInit` system: a failure then rolls
 * startup back and `run()` rejects with it.
 */
export function loadAssets<A extends AssetDeclarations, B extends string>(
  ctx: AssetCtx,
  manifest: AssetManifest<A, B>,
  bundles: NoInfer<B> | readonly NoInfer<B>[],
): Promise<void> {
  const list: readonly string[] = typeof bundles === "string" ? [bundles] : bundles;
  for (const bundle of list) checkBundle("loadAssets", manifest as AssetManifest, bundle);
  const loading = Promise.all(list.map((bundle) => loadBundle(ctx, manifest as AssetManifest, bundle))).then(noop);
  // Not awaiting it is fine: a failure is logged and sent as AssetBundleFailed either way.
  void loading.catch(noop);
  return loading;
}

/**
 * Unloads bundles of `manifest`. Each asset no other bundle (of any manifest) still holds is
 * dropped from the asset store, and its loader's `unload` runs: for a 2D texture that is Pixi's
 * `Assets.unload`, which destroys the texture. Remove the entities that show a bundle's assets
 * before unloading it; a sprite still showing a destroyed texture draws nothing or fails to render.
 * A bundle still loading is unloaded too, and its `loadAssets` promise rejects.
 */
export function unloadAssets<A extends AssetDeclarations, B extends string>(
  ctx: AssetCtx,
  manifest: AssetManifest<A, B>,
  bundles: NoInfer<B> | readonly NoInfer<B>[],
): void {
  const list: readonly string[] = typeof bundles === "string" ? [bundles] : bundles;
  const store = ctx.assets;
  const state = storeState(store);
  const runtime = runtimeOf(ctx, manifest as AssetManifest);
  for (const bundle of list) {
    checkBundle("unloadAssets", manifest as AssetManifest, bundle);
    if (!runtime.bundles.delete(bundle)) continue;
    drop(store, state, userOf(manifest as AssetManifest, bundle), membersOf(manifest as AssetManifest, bundle));
  }
  refresh(state);
}

/**
 * Loads assets of `manifest` by name, with no bundle: for a game that loads images one at a time
 * as they come into view. Each name is held like a one-asset bundle (with its fallback) until
 * `unloadAsset`, sharing the load with any bundle that lists it, and shows in `manifest.progress`
 * as `assets[name].direct` and in the top-level counts, not in `progress.bundles`.
 *
 * Safe to call again: a loading or loaded asset returns the same promise, and a failed one is
 * retried. When an asset settles it sends `AssetLoaded` (status `loaded`, `fallback` or
 * `missing`) and the promise resolves; one that fails with no fallback and is not `optional` is
 * logged, sends `AssetFailed` and rejects with an `AssetLoadError`. With several names, the
 * promise resolves when all have and rejects with the first failure; every name is tried.
 * `setAssetLoader` replaces its loader as it does for bundles.
 *
 * @example
 * void loadAsset(ctx, Art, "portrait"); // from a sync system; read progress.assets.portrait.status
 */
export function loadAsset<A extends AssetDeclarations, B extends string>(
  ctx: AssetCtx,
  manifest: AssetManifest<A, B>,
  names: NoInfer<keyof A & string> | readonly NoInfer<keyof A & string>[],
): Promise<void> {
  const list: readonly string[] = typeof names === "string" ? [names] : names;
  for (const name of list) checkAsset("loadAsset", manifest as AssetManifest, name);
  const loading = Promise.all(list.map((name) => loadOne(ctx, manifest as AssetManifest, name))).then(noop);
  // Not awaiting it is fine: a failure is logged and sent as AssetFailed either way.
  void loading.catch(noop);
  return loading;
}

/**
 * Drops the holds `loadAsset` took on `names`. Each asset no bundle (of any manifest) still holds
 * is released as `unloadAssets` releases a bundle's: out of the store, and its loader's `unload`
 * runs. A name `loadAsset` does not hold is a no-op; an asset still loading is unloaded too, and
 * its `loadAsset` promise rejects.
 */
export function unloadAsset<A extends AssetDeclarations, B extends string>(
  ctx: AssetCtx,
  manifest: AssetManifest<A, B>,
  names: NoInfer<keyof A & string> | readonly NoInfer<keyof A & string>[],
): void {
  const list: readonly string[] = typeof names === "string" ? [names] : names;
  const state = storeState(ctx.assets);
  const runtime = runtimeOf(ctx, manifest as AssetManifest);
  for (const name of list) {
    checkAsset("unloadAsset", manifest as AssetManifest, name);
    if (!runtime.direct.delete(name)) continue;
    drop(ctx.assets, state, directUserOf(manifest as AssetManifest, name), withFallbacks(manifest as AssetManifest, [name]));
  }
  refresh(state);
}

/**
 * The loaded asset `name` of `manifest`, typed by its kind: a Pixi `Texture` for `texture2d`.
 * Its fallback's value if it failed and has one. `undefined` for an `optional` asset that is
 * `missing` (its type includes `undefined` only for assets declared `optional: true`).
 * Throws if it is not loaded yet, or failed; read `manifest.progress`, or wait for
 * `AssetBundleLoaded` or `AssetLoaded`, to know when it has loaded.
 */
export function getAsset<A extends AssetDeclarations, N extends keyof A & string>(
  ctx: AssetCtx,
  manifest: AssetManifest<A, string>,
  name: N,
): ManifestAsset<A, N> {
  const declared = (manifest.assets as AssetDeclarations)[name];
  if (!declared) throw new Error(`getAsset: ${manifest.name} has no asset "${name}".`);
  const entry = liveEntry(ctx.assets, storeState(ctx.assets), name);
  if (entry?.status === "loaded" || entry?.status === "fallback") return entry.value as ManifestAsset<A, N>;
  if (entry?.status === "missing") return undefined as ManifestAsset<A, N>;
  const holders = Object.keys(manifest.bundles).filter((bundle) => manifest.bundles[bundle]!.includes(name));
  const how = holders.length ? `Load a bundle that lists it (${holders.join(", ")}) or call loadAsset.` : "Load it with loadAsset.";
  throw new Error(
    `getAsset: "${name}" of ${manifest.name} is ` +
      (entry?.status === "failed" ? `failed: ${message(entry.error)}` : `${entry ? entry.status : "not loaded"}. ${how}`),
  );
}

/**
 * Makes every manifest of this game load through `loader` instead of the asset store's loaders,
 * so a test or tool decides when each asset resolves or fails, with no network. `null` restores
 * the store's loaders. Affects loads that start afterwards.
 */
export function setAssetLoader(target: Pick<AssetCtx, "assets">, loader: ManifestLoader | null): void {
  storeState(target.assets).loader = loader ?? undefined;
}

