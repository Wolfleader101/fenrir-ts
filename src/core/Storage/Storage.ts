// Storage: typed keys with a default and a parser, over localStorage or an injected backend.
//
// Opt-in, like motion(): nothing here is reachable from code that does not import it, so a game
// without the storage() plugin ships none of it. Reads never throw and never return a value of the
// wrong shape; writes never throw. Failures fall back to memory and are logged once per key.
import type { GameBase, Plugin } from "../Game";
import type { ILogger } from "../ILogger";
import { defineResource, peekResource, type ResourceType, type Resources } from "../Resource";
import { Schedule } from "../Schedule";

/**
 * Where stored values go. Synchronous, like `localStorage`, so systems can read every frame.
 * Each method may throw: the storage functions catch it, keep the value in memory and report it.
 */
export interface StorageBackend {
  /** Shown in `StorageStatus.backend`, such as `"localStorage"` or `"memory"`. */
  readonly name: string;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /**
   * For a backend whose real store is asynchronous, such as a host app's bridge in a webview:
   * loads it into memory before the first run. The plugin awaits it in `PreInit`, so systems
   * read hydrated values; `getItem` and `setItem` then work on that copy, and the backend
   * writes it through on its own. If it rejects, the game carries on with memory only.
   */
  hydrate?(): Promise<void>;
}

/** A typed storage key, made by `defineStorageKey`. Plain data apart from `parse` and `migrate`. */
export interface StorageKey<T> {
  /** Namespaced, such as `myGame.muted`. Also the key in the backend, after the plugin's `prefix`. */
  readonly name: string;
  readonly default: T;
  /** The format version written with each value. */
  readonly version: number;
  /** Turns a stored JSON value into `T`, or returns `undefined` (or throws) if it is not one. */
  readonly parse: (value: unknown) => T | undefined;
  /** Turns a value written by an older `version` into this version's shape, before `parse`. */
  readonly migrate?: (value: unknown, from: number) => unknown;
  /** False when a migrated value is written only by the next `setStored` or `updateStored`. Absent means true. */
  readonly writeMigrated?: boolean;
}

/** What `defineStorageKey` and `defineStorageKeyFamily` take: the default value, and how to parse and migrate stored data. */
export interface StorageKeyOptions<T> {
  /** What a read returns when nothing valid is stored. Objects are copied, so mutating one is safe. */
  default: T;
  /**
   * Checks a stored value and returns it as `T`, or `undefined` (or throws) if it is invalid.
   * Defaults to a check that the value has the default's `typeof` (and is an array when the
   * default is), which is enough for primitives. Pass one for objects.
   */
  parse?: (value: unknown) => NoInfer<T> | undefined;
  /** A whole number, 1 or more. Defaults to 1. Raise it when the shape changes, with `migrate`. */
  version?: number;
  /**
   * Upgrades a value written by an older version: `from` is its version, or 0 for a value not
   * written by Fenrir (a game's own `localStorage.setItem` from before), as JSON if it parses and
   * as the raw string if not. Its result goes through `parse`; throwing means "use the default".
   */
  migrate?: (value: unknown, from: number) => unknown;
  /**
   * Whether a migrated value is written back as soon as it is read. Defaults to true: the first
   * read stores it in this version's envelope, so later reads do not migrate again.
   *
   * False keeps the migrated value in memory and leaves the stored one as it was until the game
   * writes the key (`setStored` or `updateStored`). Until then an older build of the game can
   * still read it, so a release can be rolled back without losing the value. The cost: each
   * session migrates again on its first read.
   */
  writeMigrated?: boolean;
}

/** Keys that share options and differ by a suffix, made by `defineStorageKeyFamily`. */
export interface StorageKeyFamily<T> {
  /** The key for `suffix`, named `prefix + suffix`. The same suffix returns the same key. */
  (suffix: string): StorageKey<T>;
  /** Put before each suffix, such as `myGame.best.`. */
  readonly prefix: string;
}

/** Where storage stands, as plain data: `inspect(game)` shows it under `fenrir.StorageStatus`. */
export interface StorageStatus {
  /** The backend in use: `"localStorage"`, `"memory"`, or an injected backend's name. */
  backend: string;
  /** False when values live only in memory for this session: storage was unavailable or failed to hydrate. */
  persistent: boolean;
  /** The latest failure: an unavailable store, a write that threw (quota), or a value that did not parse. */
  lastError: { key: string | null; message: string } | null;
}
export const StorageStatus = defineResource<StorageStatus>("fenrir.StorageStatus");

/** What the storage functions need: a `SystemCtx`, or the `Game` or `TestGame` itself. */
export type StorageCtx = { readonly resources: Resources; readonly logger: ILogger };

/** What the `storage()` plugin takes: the backend (default `localStorage`, falling back to memory) and a key prefix. */
export interface StorageOptions {
  /** Defaults to `localStorage`, or to memory when it is unavailable (private mode, blocked in a webview). */
  backend?: StorageBackend;
  /** Put before every key name in the backend, such as a player or save slot: `"slot2:"`. Defaults to none. */
  prefix?: string;
}

interface Runtime {
  backend: StorageBackend;
  readonly prefix: string;
  readonly logger: ILogger;
  readonly status: StorageStatus;
  /** Values read or written this session, by key name. Also the fallback when a write fails. */
  readonly cache: Map<string, unknown>;
  /** Keys already warned about, so a failing key logs once, not once per call. */
  readonly warned: Set<string | null>;
  /** Resource fields kept in keys by `persistResource`. Absent until the first one. */
  bindings?: Binding[];
  /** True until a backend's `hydrate` has finished: bindings load after it. */
  hydrating: boolean;
  /** Set by the first `persistResource`, so a game that binds nothing ships none of its code. */
  hydrated?: () => void;
}

/** One `persistResource`: a resource field and the key it is kept in. */
interface Binding {
  readonly resource: ResourceType<Record<string, unknown>>;
  readonly field: string;
  readonly key: StorageKey<unknown>;
  /** The value last loaded or saved, JSON for an object, to tell when the field changed. */
  last: unknown;
}

const runtimes = new WeakMap<Resources, Runtime>();

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** A copy of a JSON-shaped object, so a default handed out can be mutated safely. */
const copy = <T>(value: T): T => (value !== null && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value);

/**
 * A backend that keeps values in a `Map`: the fallback when `localStorage` is unavailable, and
 * the backend for tests. `items` is the map, so a test can seed it or assert on what was written.
 *
 * @example
 * const store = memoryStorage({ "myGame.muted": '{"v":1,"value":true}' });
 * const game = await createTestGame({ seed: 1, plugins: [storage({ backend: store })] });
 */
export function memoryStorage(items: Record<string, string> = {}): StorageBackend & { readonly items: Map<string, string> } {
  const map = new Map(Object.entries(items));
  return {
    name: "memory",
    items: map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function report(runtime: Runtime, key: string | null, text: string, error?: unknown): void {
  runtime.status.lastError = { key, message: error === undefined ? text : `${text}: ${message(error)}` };
  if (runtime.warned.has(key)) return;
  runtime.warned.add(key);
  runtime.logger.warn(key === null ? `Storage: ${text}` : `Storage key "${key}": ${text}`, error === undefined ? undefined : { error });
}

function fallBackToMemory(runtime: Runtime, text: string, error: unknown): void {
  runtime.backend = memoryStorage();
  runtime.status.backend = "memory";
  runtime.status.persistent = false;
  report(runtime, null, `${text}; values last only this session`, error);
}

function runtimeOf(caller: string, { resources }: StorageCtx): Runtime {
  const runtime = runtimes.get(resources);
  if (!runtime || peekResource(resources, StorageStatus) !== runtime.status) {
    throw new Error(`${caller}: needs the storage() plugin: createGame({ canvas, plugins: [storage()] }).`);
  }
  return runtime;
}

const isEnvelope = (json: unknown): json is { v: number; value: unknown } =>
  json !== null && typeof json === "object" && typeof (json as { v?: unknown }).v === "number" && "value" in json && Object.keys(json).length === 2;

/** Reads and decodes one key from the backend. Never throws. */
function load<T>(runtime: Runtime, key: StorageKey<T>): T {
  const { name } = key;
  let text: string | null;
  try {
    text = runtime.backend.getItem(runtime.prefix + name);
  } catch (error) {
    report(runtime, name, "could not be read; using the default", error);
    return copy(key.default);
  }
  if (text === null) return copy(key.default);

  // Not JSON, or JSON not in Fenrir's envelope: a value from before, version 0.
  let raw: unknown = text;
  let version = 0;
  try {
    raw = JSON.parse(text);
    if (isEnvelope(raw)) ({ v: version, value: raw } = raw);
  } catch {
    // Kept as the raw string, for migrate or parse.
  }
  if (version > key.version) {
    report(runtime, name, `was written by version ${version}, newer than this game's ${key.version}; using the default and leaving it stored`);
    return copy(key.default);
  }
  let value: T | undefined;
  try {
    if (version < key.version && key.migrate) raw = key.migrate(raw, version);
    value = key.parse(raw);
  } catch {
    value = undefined;
  }
  if (value === undefined) {
    report(runtime, name, `holds an invalid value (${text.length > 60 ? `${text.slice(0, 60)}...` : text}); using the default`);
    return copy(key.default);
  }
  // Migrated: written back in this version's envelope, so the next read does not migrate again,
  // unless the key asks to keep the old value stored until the game writes it.
  if (version < key.version && key.migrate && key.writeMigrated !== false) write(runtime, key, value);
  return value;
}

/** Writes one key to the backend. Returns whether the backend took it. Never throws. */
function write<T>(runtime: Runtime, key: StorageKey<T>, value: T): boolean {
  try {
    runtime.backend.setItem(runtime.prefix + key.name, JSON.stringify({ v: key.version, value }));
    return true;
  } catch (error) {
    report(runtime, key.name, "could not be saved (storage full or blocked); keeping it in memory for this session", error);
    return false;
  }
}

/**
 * Defines a stored value: its key, its default and how to check what is read back. As with
 * components, the name is the identity and is namespaced: `myGame.muted`. Values are stored as
 * JSON with their version: `{"v":1,"value":true}`.
 *
 * @example
 * const Muted = defineStorageKey("myGame.muted", { default: false });
 * const Best = defineStorageKey("myGame.best", {
 *   default: { score: 0, level: 1 },
 *   version: 2,
 *   parse: (v) => (isRecord(v) && typeof v.score === "number" && typeof v.level === "number" ? { score: v.score, level: v.level } : undefined),
 *   migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v, level: 1 } : v), // v1 stored a bare number
 * });
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineStorageKey<T>(name: string, options: StorageKeyOptions<T>): StorageKey<T> {
  const { default: fallback, version = 1, migrate, writeMigrated } = options;
  if (!(Number.isInteger(version) && version >= 1)) {
    throw new Error(`defineStorageKey("${name}"): version must be a whole number, 1 or more, got ${version}.`);
  }
  const parse =
    options.parse ??
    ((value: unknown): T | undefined =>
      typeof value === typeof fallback && Array.isArray(value) === Array.isArray(fallback) && (value === null) === (fallback === null) ? (value as T) : undefined);
  const key: StorageKey<T> = { name, default: fallback, version, parse, migrate };
  // Only when false, so keys without it look as they did.
  return Object.freeze(writeMigrated === false ? { ...key, writeMigrated } : key);
}

/**
 * Defines keys that share a default, parser, version and migration and differ by a suffix: one
 * per player, save slot or level. `family(suffix)` is the key named `prefix + suffix`, made on
 * first use and the same object every time after, so it can be called in a system each frame.
 * The prefix is used as given: end it with the separator, such as `myGame.best.`.
 *
 * Throws, as `defineStorageKey` does, for invalid options, and for a suffix that is not a
 * non-empty string.
 *
 * @example
 * const BestTime = defineStorageKeyFamily("myGame.best.", { default: 0 });
 * setStored(ctx, BestTime(levelId), 42.5); // stored as "myGame.best.<levelId>"
 * getStored(ctx, BestTime(levelId));
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineStorageKeyFamily<T>(prefix: string, options: StorageKeyOptions<T>): StorageKeyFamily<T> {
  // Checks the options now, not at the first suffix.
  defineStorageKey(prefix, options);
  const keys = new Map<string, StorageKey<T>>();
  const family = (suffix: string): StorageKey<T> => {
    if (typeof suffix !== "string" || !suffix) {
      throw new Error(`defineStorageKeyFamily("${prefix}"): a key needs a suffix, a non-empty string, got ${JSON.stringify(suffix)}.`);
    }
    let key = keys.get(suffix);
    if (!key) keys.set(suffix, (key = defineStorageKey(prefix + suffix, options)));
    return key;
  };
  return Object.assign(family, { prefix });
}

/**
 * The stored value of `key`: what was set this session, else what the backend holds if it is
 * valid, else the default. Never throws. A value that cannot be read, is not JSON, is from a
 * newer version or does not parse gives the default, logged once per key. Cached after the first
 * read, so reading every frame is cheap. Mutating a returned object changes the cached value
 * only: call `setStored` to save it.
 */
export function getStored<T>(ctx: StorageCtx, key: StorageKey<T>): T {
  const runtime = runtimeOf("getStored", ctx);
  if (runtime.cache.has(key.name)) return runtime.cache.get(key.name) as T;
  const value = load(runtime, key);
  runtime.cache.set(key.name, value);
  return value;
}

/**
 * Stores `value` under `key`. Never throws: if the backend refuses it (quota, blocked, or a
 * value JSON cannot hold), the value is kept in memory, so `getStored` returns it for the rest
 * of the session, and the failure is logged once per key and set in `StorageStatus.lastError`.
 * Returns whether the backend took it.
 */
export function setStored<T>(ctx: StorageCtx, key: StorageKey<T>, value: NoInfer<T>): boolean {
  const runtime = runtimeOf("setStored", ctx);
  runtime.cache.set(key.name, value);
  return write(runtime, key, value);
}

/** Stores `update(current)` under `key` and returns it. As `setStored`, it never throws. */
export function updateStored<T>(ctx: StorageCtx, key: StorageKey<T>, update: (current: T) => NoInfer<T>): T {
  const value = update(getStored(ctx, key));
  setStored(ctx, key, value);
  return value;
}

/** Removes `key` from the backend and from memory, so the next read gives the default. Never throws. */
export function removeStored(ctx: StorageCtx, key: StorageKey<unknown>): void {
  const runtime = runtimeOf("removeStored", ctx);
  runtime.cache.delete(key.name);
  try {
    runtime.backend.removeItem(runtime.prefix + key.name);
  } catch (error) {
    report(runtime, key.name, "could not be removed", error);
  }
}

/** What `persistResource` compares: primitives as they are, objects as JSON, so an edit in place counts. */
const snapshot = (value: unknown): unknown => (value !== null && typeof value === "object" ? JSON.stringify(value) : value);

/** Sets the field from its key. */
function loadBinding(runtime: Runtime, resources: Resources, binding: Binding): void {
  const value = getStored({ resources, logger: runtime.logger }, binding.key);
  const target = peekResource(resources, binding.resource);
  if (target) target[binding.field] = value;
  binding.last = snapshot(value);
}

/** Saves every bound field that changed since it was loaded or last saved. */
function saveBindings(runtime: Runtime, resources: Resources): void {
  for (const binding of runtime.bindings!) {
    const target = peekResource(resources, binding.resource);
    // The resource was cleared (Engine.reset): nothing to save until it has a value again.
    if (!target) continue;
    const value = target[binding.field];
    const now = snapshot(value);
    if (Object.is(now, binding.last)) continue;
    binding.last = now;
    setStored({ resources, logger: runtime.logger }, binding.key, value);
  }
}

/**
 * Keeps `resource[field]` in the storage key `key`, so a setting such as `AudioState.muted` is
 * saved with no hand-written sync. Setup, like `game.on`: call it once, after `createGame` (the
 * resource must have a value, so after the plugin that adds it is installed).
 *
 * - Load: the field is set from the key at once or, with a backend that hydrates, as soon as
 *   `fenrir.storage.preInit` has hydrated it, before the game's startup systems. With nothing
 *   valid stored, the field gets the key's default, so give the key the resource's default.
 * - Save: when the field's value has changed, it is written with `setStored` at the end of each
 *   frame (`fenrir.storage.postUpdate`) and when a run stops (`fenrir.storage.exit`). Objects
 *   are compared as JSON, so editing one in place counts as a change.
 * - The binding owns the key: change the field, not the key, or the field will not follow.
 *   Returns a function that ends the binding and leaves what is stored.
 *
 * Nothing is persisted unless the game asks: the engine binds no field of its own.
 *
 * Throws without the `storage()` plugin, when the resource has no value, or when the key is
 * already bound.
 *
 * @example
 * const Muted = defineStorageKey("myGame.muted", { default: false });
 * const game = await createGame({ canvas, plugins: [storage(), audio(), pixi2d()] });
 * persistResource(game, AudioState, "muted", Muted);
 */
export function persistResource<T extends object, K extends keyof T & string>(
  game: Pick<GameBase, "resources" | "logger" | "addSystem">,
  resource: ResourceType<T>,
  field: K,
  key: StorageKey<T[K]>,
): () => void {
  const caller = `persistResource(${resource.name}.${field})`;
  const runtime = runtimeOf(caller, game);
  const { resources } = game;
  if (!resources.has(resource)) {
    try {
      // A resource with a factory gets its value here.
      resources.get(resource);
    } catch {
      throw new Error(`${caller}: the resource has no value. Install the plugin that adds it, or set it, before binding it.`);
    }
  }
  if (!runtime.bindings) {
    const all: Binding[] = (runtime.bindings = []);
    runtime.hydrated = () => {
      for (const binding of all) loadBinding(runtime, resources, binding);
    };
    const save = () => saveBindings(runtime, resources);
    // Named by option, not nameEngineSystems: SystemName.ts would pull its stage list into every core bundle.
    game.addSystem(Schedule.PostUpdate, save, { name: "fenrir.storage.postUpdate" });
    game.addSystem(Schedule.Exit, save, { name: "fenrir.storage.exit" });
  }
  const { bindings } = runtime;
  if (bindings.some((b) => b.key.name === key.name)) throw new Error(`${caller}: storage key "${key.name}" is already bound to a resource field.`);
  const binding: Binding = { resource: resource as unknown as Binding["resource"], field, key: key as StorageKey<unknown>, last: undefined };
  bindings.push(binding);
  if (!runtime.hydrating) loadBinding(runtime, resources, binding);
  return () => {
    const at = bindings.indexOf(binding);
    if (at >= 0) bindings.splice(at, 1);
  };
}

/** `localStorage`, checked with a write and a remove, or why it cannot be used. */
function localStorageBackend(prefix: string): StorageBackend {
  const store = globalThis.localStorage;
  if (!store) throw new Error("localStorage is not defined");
  const probe = `${prefix}fenrir.storage.probe`;
  store.setItem(probe, "1");
  store.removeItem(probe);
  return {
    name: "localStorage",
    getItem: (key) => store.getItem(key),
    setItem: (key, value) => store.setItem(key, value),
    removeItem: (key) => store.removeItem(key),
  };
}

/**
 * Stores typed values: `getStored`, `setStored`, `updateStored` and `removeStored` need it. It
 * adds the `StorageStatus` resource and uses `localStorage` unless given a `backend`. When
 * `localStorage` is unavailable (private mode, storage blocked in a webview or sandboxed frame),
 * it falls back to memory, logs one warning and sets `StorageStatus.persistent` to false: the
 * game keeps working, and values last for the session.
 *
 * A backend with `hydrate` is awaited once, in `fenrir.storage.preInit`, before the first run's
 * other startup systems. Values are not tied to a run: they stay across `stop()` and `run()`.
 * Changes made by another tab are not seen while a value is cached.
 *
 * @example
 * const game = await createGame({ canvas, plugins: [storage(), pixi2d()] });
 * const test = await createTestGame({ seed: 1, plugins: [storage({ backend: memoryStorage() })] });
 */
export function storage(options: StorageOptions = {}): Plugin {
  const { prefix = "" } = options;
  return {
    name: "fenrir.storage",
    install(game) {
      const status: StorageStatus = { backend: "memory", persistent: true, lastError: null };
      const runtime: Runtime = { backend: undefined!, prefix, logger: game.logger, status, cache: new Map(), warned: new Set(), hydrating: false };
      game.resources.set(StorageStatus, status);
      runtimes.set(game.resources, runtime);
      try {
        runtime.backend = options.backend ?? localStorageBackend(prefix);
        status.backend = runtime.backend.name;
      } catch (error) {
        fallBackToMemory(runtime, "localStorage is unavailable", error);
      }

      const { hydrate } = runtime.backend;
      if (!hydrate) return;
      runtime.hydrating = true;
      let hydrated = false;
      // Named by option, not nameEngineSystems: SystemName.ts would pull its stage list into every core bundle.
      game.addSystem(Schedule.PreInit, async function hydrateStorage() {
        if (hydrated) return;
        hydrated = true;
        try {
          await hydrate.call(runtime.backend);
        } catch (error) {
          fallBackToMemory(runtime, `${runtime.backend.name} failed to load`, error);
        }
        // Anything read before hydration came from an empty store.
        runtime.cache.clear();
        runtime.hydrating = false;
        runtime.hydrated?.();
      }, { name: "fenrir.storage.preInit" });
    },
  };
}
